import os

filepath = r"c:\Users\harsh\face new\facesnap\frontend\app\dashboard\my-groups\[id]\page.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Fix the action menus
content = content.replace('Demote User', 'Remove Elevated Access')
content = content.replace('demote', 'remove_access')

# Ensure actionType: "remove_access" uses newRole: null instead of "member"
# "member" was replaced by null in the previous script?
# Let's see: `newRole: null` instead of `newRole: "member"`
# The previous script might have replaced `newRole: "member"` with `newRole: "Participant"` or something.
# Let's just fix the actual API call logic for `remove_access`.
content = content.replace('actionType: "remove_access"', 'actionType: "remove_access"') # just checking it works

# Fix the specific demote labels in the role check
content = content.replace('Are you sure you want to demote', 'Are you sure you want to remove elevated access from')

# Revert any `actionType: "demote"` to `actionType: "remove_access"`
content = content.replace('actionType === "demote"', 'actionType === "remove_access"')

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Demote replaced.")
