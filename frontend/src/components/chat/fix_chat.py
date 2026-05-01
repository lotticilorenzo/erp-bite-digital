import os
with open('ChatInput.tsx', 'r') as f:
    content = f.read()

content = content.replace('''      console.error("Upload failed", err);
        });
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {''', '''      console.error("Upload failed", err);
    } finally {''')

content = content.replace('''  const handleKeyDown = (e: React.KeyboardEvent) => {

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {''', '''  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {''')

content = content.replace('''      <style>{`
        @keyframes soundWave {
          from { opacity: 0.4; transform: scaleY(0.4); }
          to   { opacity: 1;   transform: scaleY(1);   }
        }
      `}</style>
    </div>
  );
}
''', '''      <style>{`
        @keyframes soundWave {
          from { opacity: 0.4; transform: scaleY(0.4); }
          to   { opacity: 1;   transform: scaleY(1);   }
        }
      `}</style>
    </div>
  );
}
''')

with open('ChatInput.tsx', 'w') as f:
    f.write(content)
