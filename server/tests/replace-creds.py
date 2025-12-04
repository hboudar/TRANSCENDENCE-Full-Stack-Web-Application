with open('socket-advanced-tests.js', 'r') as f:
    content = f.read()

content = content.replace("'testuser1@test.com'", 'TEST_USERS.user1.email')
content = content.replace("'testuser2@test.com'", 'TEST_USERS.user2.email')
content = content.replace("'testuser3@test.com'", 'TEST_USERS.user3.email')
content = content.replace(", 'Test123!@#'", ', TEST_USERS.user1.password')

with open('socket-advanced-tests.js', 'w') as f:
    f.write(content)

print('✅ Updated successfully')
