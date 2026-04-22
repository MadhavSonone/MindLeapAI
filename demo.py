import json


with open('./data/jee.json', 'r') as file:
    data = json.load(file)

# If JSON is a dictionary
for key in data.keys():
    print(key)