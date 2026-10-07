import io
import json
import posixpath
from pathlib import Path
import threading
import unittest
import zipfile
import xml.etree.ElementTree as ET
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer

from arena.curriculum import LABS, get_template, BOARD
from arena.projects import normalize_project, export_project
from arena.simulation import Simulation, CompileError
from arena.grading import judge
from tests.fixtures import reference

class PeripheralTests(unittest.TestCase):
    def test_original_led_blinks(self):
        with Simulation(normalize_project(get_template('lab1-1'))) as sim:
            self.assertEqual(sim.step(duration_us=100000)['ledMask'],1)
            self.assertEqual(sim.step(duration_us=100000)['ledMask'],0)

    def test_real_matrix_scan_and_display_driver(self):
        with Simulation(normalize_project(get_template('lab3-1'))) as sim:
            for key in range(1,10):
                # The first multiplexed frame includes the previous key's
                # segments. Check the next complete, settled frame.
                sim.step([key],100000)
                frame=sim.step([key],100000)
                self.assertEqual(frame['display'],f'000{key}')
            sim.step([],100000)
            self.assertEqual(sim.step([],100000)['display'],'0000')

    def test_edited_driver_changes_the_board(self):
        project=normalize_project(get_template('lab3-1'))
        project['files']['Seven_Segment.c']=project['files']['Seven_Segment.c'].replace('  uint8_t temp,i;','  if (number == 0) return;\n  uint8_t temp,i;')
        with Simulation(project) as sim:
            self.assertEqual(sim.step([1],100000)['display'],'   1')
            self.assertEqual(sim.step([],100000)['display'],'    ')

    def test_compile_errors_are_reported(self):
        project=reference('lab1-1')
        project['files']['main.c']='int main(void) { this is invalid C; }'
        with self.assertRaises(CompileError):
            Simulation(project)

    def test_nonresponsive_program_is_terminated(self):
        project=reference('lab1-1')
        project['files']['main.c']='int main(void) { while(1) {} }'
        with Simulation(project) as sim:
            with self.assertRaises(RuntimeError):
                sim.step([],1000)
            self.assertIsNotNone(sim.proc.poll())

class GradingTests(unittest.TestCase):
    def test_classroom_programs_pass_all_six_labs(self):
        for lab in LABS:
            with self.subTest(lab=lab['id']):
                result=judge(reference(lab['id']))
                self.assertEqual(result['verdict'],'AC',json.dumps(result['cases'],ensure_ascii=True))

    def test_reverse_marquee(self):
        self.assertEqual(judge(reference('lab1-2',{'direction':-1}))['verdict'],'AC')

    def test_timer_configuration_boundaries(self):
        for seconds in (0,59):
            with self.subTest(seconds=seconds):
                result=judge(reference('lab3-1',{'initialSeconds':seconds}))
                self.assertEqual(result['verdict'],'AC',json.dumps(result['cases'],ensure_ascii=True))

    def test_static_wrong_solution_fails(self):
        project=reference('lab1-2')
        project['files']['main.c']='#include "NUC100Series.h"\nint main(void) {GPIO_SetMode(PC,BIT12,GPIO_MODE_OUTPUT);PC12=0;while(1)CLK_SysTickDelay(1000);}'
        self.assertEqual(judge(project)['verdict'],'WA')

    def test_original_sample_is_not_mistaken_for_lab_answer(self):
        self.assertEqual(judge(normalize_project(get_template('lab3-2')))['verdict'],'WA')

class ProjectTests(unittest.TestCase):
    def test_every_available_sample_exports_with_complete_dependencies(self):
        seen=set()
        for lab in LABS:
            for sample in lab['samples']:
                if sample in seen:
                    continue
                seen.add(sample)
                with self.subTest(sample=sample):
                    project=normalize_project(get_template(lab['id'],sample_id=sample))
                    with zipfile.ZipFile(io.BytesIO(export_project(project))) as archive:
                        names=set(archive.namelist())
                        path=next(name for name in names if name.endswith('.uvproj'))
                        xml=ET.fromstring(archive.read(path))
                        for source in xml.findall('.//Groups/Group/Files/File/FilePath'):
                            resolved=posixpath.normpath(posixpath.join(posixpath.dirname(path),source.text.replace('\\','/')))
                            self.assertIn(resolved,names)

    def test_keil_export_is_self_contained_and_preserves_edits(self):
        original=(BOARD/'Source'/'Seven_Segment.c').read_bytes()
        project=reference('lab3-2')
        project['files']['Seven_Segment.c']+='\n/* user edit */\n'
        with zipfile.ZipFile(io.BytesIO(export_project(project))) as archive:
            names=set(archive.namelist())
            project_path=next(name for name in names if name.endswith('.uvproj'))
            xml=ET.fromstring(archive.read(project_path))
            self.assertEqual(xml.findtext('Targets/Target/TargetOption/TargetCommonOption/Device'),'NUC140VE3CN')
            for file in xml.findall('.//Groups/Group/Files/File/FilePath'):
                resolved=posixpath.normpath(posixpath.join(posixpath.dirname(project_path),file.text.replace('\\','/')))
                self.assertIn(resolved,names)
            for path in xml.findtext('.//Cads/VariousControls/IncludePath').split(';'):
                resolved=posixpath.normpath(posixpath.join(posixpath.dirname(project_path),path.replace('\\','/')))
                self.assertTrue(any(name.startswith(resolved+'/') for name in names),resolved)
            main=next(name for name in names if name.endswith('/main.c'))
            self.assertEqual(archive.read(main).decode('utf-8'),project['files']['main.c'])
            driver=next(name for name in names if name.endswith('/Source/Seven_Segment.c'))
            self.assertTrue(archive.read(driver).endswith(b'/* user edit */\n'))
            self.assertFalse(any('/sim/' in name for name in names))
        self.assertEqual((BOARD/'Source'/'Seven_Segment.c').read_bytes(),original)

    def test_path_traversal_and_invalid_parameters_rejected(self):
        with self.assertRaises(ValueError):
            normalize_project(dict(labId='lab1-1',files={'main.c':'','../../escape.c':''}))
        with self.assertRaises(ValueError):
            reference('lab1-1',{'date':'not-date'})

class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from server import Handler
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close()

    def test_course_api_and_static_ui(self):
        connection=HTTPConnection('127.0.0.1',self.server.server_port)
        connection.request('GET','/api/labs')
        response=connection.getresponse()
        self.assertEqual(len(json.loads(response.read())),6)
        connection.request('GET','/')
        response=connection.getresponse()
        self.assertIn(b'NUC140 Lab Arena',response.read())
        connection.close()

    def test_cross_origin_requests_rejected(self):
        connection=HTTPConnection('127.0.0.1',self.server.server_port)
        connection.request('POST','/api/simulations',body='{}',headers={'Origin':'https://example.com','Content-Type':'application/json'})
        response=connection.getresponse()
        self.assertEqual(response.status,403)
        response.read();connection.close()

if __name__=='__main__':
    unittest.main()
