/**
 * Flower2U — Google Drive Image Uploader (Google Apps Script Web App)
 *
 * รองรับการอัปโหลดและลบไฟล์จากทุกหน้าในแอป Flower2U:
 * - รูปโปรไฟล์พนักงาน (Staff)
 * - รูปศิลปิน (Artists)
 * - โลโก้ร้าน / รูปงาน / สลิปโอนเงิน (App / Finance)
 * - รูปสินค้าในคลัง (Inventory)
 *
 * การตั้งค่า Deploy:
 *   Deploy -> New deployment -> Web app
 *   - Execute as: Me
 *   - Who has access: Anyone
 */

function doGet() {
  return createJsonResponse({ status: 'ok', service: 'Flower2U Drive Uploader' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: 'error', message: 'Empty request body' });
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    // 1. อัปโหลดรูป / ไฟล์เข้า Google Drive
    if (action === 'uploadAsset') {
      var data = payload.data || {};
      var folderId = String(data.folderId || '').trim();
      var rawFileData = String(data.fileData || '').trim();
      var fileName = String(data.fileName || ('asset_' + Date.now() + '.jpg')).trim();
      var mimeType = String(data.mimeType || 'image/jpeg').trim();

      if (!folderId || !rawFileData) {
        return createJsonResponse({ status: 'error', message: 'Missing folderId or fileData' });
      }

      // รองรับทั้งแบบมี prefix "data:image/...;base64," และแบบ base64 ล้วน
      var base64Body = rawFileData;
      var dataUriMatch = rawFileData.match(/^data:([^;]+);base64,(.*)$/s);
      if (dataUriMatch) {
        if (!data.mimeType) mimeType = dataUriMatch[1];
        base64Body = dataUriMatch[2];
      }

      var folder = DriveApp.getFolderById(folderId);
      var bytes = Utilities.base64Decode(base64Body);
      var blob = Utilities.newBlob(bytes, mimeType, fileName);
      var file = folder.createFile(blob);

      // เปิดสิทธิ์ให้ดูผ่านลิงก์ได้ (เพื่อให้หน้าเว็บโหลดรูปได้)
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      var fileId = file.getId();
      var directUrl = 'https://lh3.googleusercontent.com/d/' + fileId;

      return createJsonResponse({
        status: 'success',
        fileId: fileId,
        url: directUrl
      });
    }

    // 2. ลบไฟล์ (ย้ายลงถังขยะ Google Drive)
    if (action === 'deleteFile') {
      var targetId = String(payload.id || '').trim();
      if (!targetId) {
        return createJsonResponse({ status: 'error', message: 'Missing file id' });
      }
      DriveApp.getFileById(targetId).setTrashed(true);
      return createJsonResponse({ status: 'success', message: 'File moved to trash' });
    }

    return createJsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
