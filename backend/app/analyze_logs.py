import subprocess
import re

def parse_logs():
    print("Fetching logs...")
    result = subprocess.run(["docker", "logs", "bite_erp_backend"], capture_output=True, text=True)
    logs = result.stdout + result.stderr
    
    # Split by lines
    lines = logs.split("\n")
    
    # Find indices of DBAPIError
    for i, line in enumerate(lines):
        if 'DBAPIError' in line or 'Exception' in line:
            print(f"Found error at line {i}: {line}")
            # Look back and forward
            start = max(0, i - 10)
            end = min(len(lines), i + 20)
            print("--- Context ---")
            for j in range(start, end):
                print(lines[j])
            print("--- End Context ---")

if __name__ == "__main__":
    parse_logs()
