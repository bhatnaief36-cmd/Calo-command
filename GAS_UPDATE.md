# GAS Script Updates Required

Paste these changes into your Google Apps Script (GAS) file.

## 1. Update the admin account in checkLogin()

In your `checkLogin` function, REMOVE any hardcoded old accounts (TC-UAE, RTS-GLOBAL, HR-UAE, TR-QUAL-UAE, DM-UAE, and the old admin) and ADD this new admin block at the top:

```javascript
function checkLogin(params) {
  const username = params.username || '';
  const password = params.password || '';
  
  // Global Admin (hardcoded — only account not in Sheets)
  if(username.toLowerCase() === 'admin@calo.app' && password === 'Sallie@2026') {
    return {
      success: true,
      name: 'CALO-ADMIN',
      role: 'GLOBAL_ADMIN',
      level: 1,
      market: 'All',
      dept: null,
      title: 'Global Administrator'
    };
  }
  
  // All other users — read from Dynamic_Users sheet
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dynamic_Users');
  if (!sheet) return { success: false };
  
  const data = sheet.getDataRange().getValues();
  // Expected columns: username | password | name | level | market | dept | title
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (String(row[0]).trim() === String(username).trim() && 
        String(row[1]).trim() === String(password).trim()) {
      return {
        success: true,
        name:    String(row[2]),
        role:    String(row[5]||''),
        level:   parseInt(row[3]) || 4,
        market:  String(row[4]),
        dept:    String(row[5]||'') || null,
        title:   String(row[6]||'')
      };
    }
  }
  
  return { success: false };
}
```

## 2. Add getUsers() function

```javascript
function getUsers() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dynamic_Users');
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const users = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // skip empty rows
    users.push({
      username: String(row[0]).trim(),
      pass:     String(row[1]).trim(),
      name:     String(row[2]).trim(),
      level:    parseInt(row[3]) || 4,
      market:   String(row[4]).trim(),
      dept:     String(row[5]||'').trim(),
      title:    String(row[6]||'').trim(),
      active:   true
    });
  }
  return users;
}
```

## 3. Add deleteUser() function

```javascript
function deleteUser(params) {
  const username = params.username || '';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dynamic_Users');
  if (!sheet) return { success: false };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(username).trim()) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, message: 'User not found' };
}
```

## 4. Add updateUserPassword() function

```javascript
function updateUserPassword(params) {
  const username = params.username || '';
  const newPassword = params.newPassword || '';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Dynamic_Users');
  if (!sheet) return { success: false };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(username).trim()) {
      sheet.getRange(i + 1, 2).setValue(newPassword);
      return { success: true };
    }
  }
  return { success: false, message: 'User not found' };
}
```

## 5. Update the main doPost() / action router to handle new actions

In your main function that routes actions (usually called `doPost`), add cases for the new actions:

```javascript
case 'getUsers':           return ContentService.createTextOutput(JSON.stringify(getUsers())).setMimeType(ContentService.MimeType.JSON);
case 'deleteUser':         return ContentService.createTextOutput(JSON.stringify(deleteUser(params))).setMimeType(ContentService.MimeType.JSON);
case 'updateUserPassword': return ContentService.createTextOutput(JSON.stringify(updateUserPassword(params))).setMimeType(ContentService.MimeType.JSON);
```

## 6. Dynamic_Users Sheet Column Structure

Make sure your Dynamic_Users sheet has these columns in this exact order:
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| username | password | name | level | market | dept | title |

Example rows:
| TC-UAE | Tc@UAE25 | Training Coord UAE | 3 | UAE |  | Training Coordinator · UAE |
| HR-UAE | Hr@UAE25 | HR Officer UAE | 4 | UAE | HR_Status | HR Officer · UAE |

## 7. Deploy a new version

After pasting all changes, click **Deploy → Manage deployments → Edit → New version → Deploy**.
This is required for the changes to take effect.
