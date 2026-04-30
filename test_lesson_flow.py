import json

with open("backend/data/focus_lessons.json", encoding="utf-8") as f:
    data = json.load(f)

lesson = data["1.1"]

print("Lesson type:", lesson["type"])
print("\n--- START LESSON ---\n")

print("Today we study:", lesson["type"])
print("\nContent:\n")
print(lesson["text"][:1000])