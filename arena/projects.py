"""Portable Keil bundles built from an untouched BSP baseline."""
import io
import zipfile
import xml.etree.ElementTree as ET
from .curriculum import BSP, SAMPLES, get_lab, get_template, config_header, validate_config

EDITABLE = {"main.c", "MCU_init.h", "Scankey.c", "Seven_Segment.c"}
MAX_SOURCE_BYTES = 160_000

def normalize_project(data):
    lab = get_lab(data.get("labId"))
    if not lab:
        raise ValueError("找不到這個 Lab 題目。")
    sample_id = data.get("sampleId") or lab["sample"]
    if sample_id not in lab["samples"]:
        raise ValueError("不支援這個範例。")
    config = validate_config(data.get("config"))
    template = get_template(lab["id"], True, sample_id, config)
    supplied = data.get("files")
    if not isinstance(supplied, dict) or "main.c" not in supplied:
        raise ValueError("請提供 main.c。")
    if any(name not in EDITABLE | {"lab_config.h"} for name in supplied):
        raise ValueError("檔案名稱不在這份課堂專案的編輯範圍內。")
    if any(not isinstance(content, str) or "\x00" in content for content in supplied.values()):
        raise ValueError("原始碼需為文字。")
    if sum(len(text.encode("utf-8")) for text in supplied.values()) > MAX_SOURCE_BYTES:
        raise ValueError("專案原始碼超過 160KB。")
    files = {name: supplied.get(name, template["files"][name]) for name in EDITABLE}
    files["lab_config.h"] = config_header(config)
    return dict(labId=lab["id"], sampleId=sample_id, config=config, files=files)

def export_project(project):
    """Keep the original four-level relative library paths valid in the zip."""
    lab_id, sample = project["labId"], project["sampleId"]
    root = f"NUC140_{lab_id.replace('-', '_')}"
    user = f"SampleCode/Nu-LB-NUC140/{sample}"
    entries = {}
    for file in (BSP / "Library").rglob("*"):
        if file.is_file():
            entries[file.relative_to(BSP).as_posix()] = file.read_bytes()
    folder = SAMPLES / sample
    for file in folder.rglob("*"):
        if file.is_file() and file.suffix.lower() in (".c", ".h", ".uvproj", ".ini"):
            entries[f"{user}/{file.relative_to(folder).as_posix()}"] = file.read_bytes()
    for name, content in project["files"].items():
        path = (f"Library/Nu-LB-NUC140/Source/{name}" if name in ("Scankey.c", "Seven_Segment.c")
                else f"{user}/{name}")
        entries[path] = content.encode("utf-8")
    project_path = next(path for path in entries if path.endswith(".uvproj"))
    tree = ET.fromstring(entries[project_path])
    target = tree.find("Targets/Target")
    target.find("TargetName").text = lab_id
    common = target.find("TargetOption/TargetCommonOption")
    common.find("OutputName").text = lab_id.replace("-", "_")
    common.find("OutputDirectory").text = ".\\obj\\"
    present = {node.text.casefold() for node in target.findall("Groups/Group/Files/File/FileName")}
    user_group = next(group for group in target.findall("Groups/Group") if group.findtext("GroupName") == "User")
    for name in ("Scankey.c", "Seven_Segment.c"):
        if name.casefold() not in present:
            node = ET.SubElement(user_group.find("Files"), "File")
            ET.SubElement(node, "FileName").text = name
            ET.SubElement(node, "FileType").text = "1"
            ET.SubElement(node, "FilePath").text = "..\\..\\..\\..\\Library\\Nu-LB-NUC140\\Source\\" + name
    ET.indent(tree, space="  ")
    entries[project_path] = ET.tostring(tree, encoding="utf-8", xml_declaration=True)
    entries["README.txt"] = (
        "NUC140 Lab Arena / Keil project\r\n\r\n"
        f"Lab: {lab_id}\r\nSample: {sample}\r\nDevice: NUC140VE3CN\r\n\r\n"
        f"Open: {project_path}\r\n"
        "Use the classroom ARM Compiler 5 / Nu-Link settings.\r\n"
        "The Library directory is required; preserve this folder structure.\r\n"
        "Your edited source and portable lab_config.h are included.\r\n"
        "Simulation results do not certify real-board timing or successful flashing.\r\n"
    ).encode("utf-8")
    entries["THIRD_PARTY_NOTICES.md"] = (BSP.parent / "THIRD_PARTY_NOTICES.md").read_bytes()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, content in sorted(entries.items()):
            archive.writestr(f"{root}/{path}", content)
    return output.getvalue()
