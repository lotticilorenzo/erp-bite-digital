import subprocess

# Run git diff as bytes
result = subprocess.run(
    ["git", "diff", "402186c", "3628d19"],
    cwd="c:\\Users\\lotti\\Desktop\\erp-bite-digital",
    capture_output=True
)

stdout_bytes = result.stdout
diff_text = stdout_bytes.decode('utf-8', errors='ignore')
diff_lines = diff_text.splitlines()

current_file = ""
for line in diff_lines:
    if line.startswith("diff --git"):
        current_file = line.split(" ")[-1]
    if line.startswith("+") and not line.startswith("+++"):
        if any(kw in line.lower() for kw in ["pass", "pwd", "secret", "smtp", "mail", "gmail"]):
            if "import" in line or "class" in line:
                continue
            # Print as ascii to avoid console encoding crashes
            safe_line = line.encode('ascii', errors='replace').decode('ascii')
            print(f"File: {current_file} -> {safe_line}")
