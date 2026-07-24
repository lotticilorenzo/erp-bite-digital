import os

log_files = [
    "backend_logs.txt",
    "backend/backend_logs.txt",
    "backend/backend_full.log",
    "backend/full_logs.txt",
    "backend/logs_audit.log",
    "backend/temp_logs.txt",
    "backend/tmp_logs.txt"
]

for filename in log_files:
    if os.path.exists(filename):
        print(f"=== SEARCHING {filename} ===")
        try:
            for encoding in ['utf-8', 'utf-16', 'utf-16-le', 'latin-1']:
                try:
                    with open(filename, 'r', encoding=encoding) as f:
                        lines = f.readlines()
                    found = False
                    for i, line in enumerate(lines):
                        if any(x in line.lower() for x in ["exception", "error", "nodes", "fail", "500"]):
                            # filter out common logs that are not errors
                            if "fic_sync_runs" in line:
                                continue
                            print(f"Line {i+1}: {line.strip()}")
                            # print context
                            for j in range(max(0, i-2), min(len(lines), i+8)):
                                print(f"  [{j+1}] {lines[j].strip()}")
                            print("-" * 40)
                            found = True
                    if found:
                        break
                except UnicodeDecodeError:
                    continue
        except Exception as e:
            print(f"Error reading {filename}: {e}")
