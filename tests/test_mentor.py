import json
import subprocess
import unittest
from unittest.mock import patch

from arena.mentor import decode_response, mentor_reply
from tests.fixtures import reference


class MentorTests(unittest.TestCase):
    def test_terminal_success_is_decoded(self):
        stream='startup message\n'+json.dumps(dict(event='result',result=dict(status='SUCCESS',response='提示：0 會點亮 LED。')))
        self.assertEqual(decode_response(stream)['reply'],'提示：0 會點亮 LED。')

    def test_failed_terminal_status_rejects_partial_answer(self):
        stream=json.dumps(dict(event='step_update',step_update=dict(step_type='agent_response',text_delta='partial')))+'\n'
        stream+=json.dumps(dict(event='result',result=dict(status='ERROR',response='partial')))
        with self.assertRaises(RuntimeError):
            decode_response(stream)

    def test_login_failure_has_actionable_message(self):
        with self.assertRaisesRegex(RuntimeError,'尚未登入'):
            decode_response('',stderr='You are not logged into Antigravity.',returncode=1)

    def test_source_and_question_are_transmitted_through_stdin(self):
        stream=json.dumps(dict(event='result',result=dict(status='SUCCESS',response='先檢查 GPIO 模式。'))).encode()
        with patch('arena.mentor.agy_path',return_value='agy'), patch('arena.mentor.subprocess.run',return_value=subprocess.CompletedProcess([],0,stream,b'')) as run:
            result=mentor_reply(reference('lab1-1'),'為什麼不亮？',[],{})
        self.assertEqual(result['reply'],'先檢查 GPIO 模式。')
        command=run.call_args.args[0]
        self.assertIn('--sandbox',command)
        self.assertEqual(command[command.index('--mode')+1],'plan')
        self.assertNotIn('--dangerously-skip-permissions',command)
        message=json.loads(run.call_args.kwargs['input'].decode())['message']['content']
        self.assertIn('為什麼不亮？',message)
        self.assertIn('LAB_STUDENT_DIGIT',message)


if __name__=='__main__':
    unittest.main()
