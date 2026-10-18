import React from 'react';

// Common Formatters and URL Utilities

export const shadeColor = (color, percent) => {
  if (!color) return '#000000';
  var f = parseInt(color.slice(1), 16),
    t = percent < 0 ? 0 : 255,
    p = percent < 0 ? percent * -1 : percent,
    R = f >> 16,
    G = (f >> 8) & 0x00ff,
    B = f & 0x0000ff;
  return (
    "#" +
    (
      0x1000000 +
      (Math.round((t - R) * p) + R) * 0x10000 +
      (Math.round((t - G) * p) + G) * 0x100 +
      (Math.round((t - B) * p) + B)
    )
      .toString(16)
      .slice(1)
  );
};

export const hexToRgbString = (hex) => {
  if (!hex) return '0, 0, 0';
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0';
};

// [MODIFIED] ปรับปรุงฟังก์ชันแปลงลิงก์: ใช้ lh3.googleusercontent.com/d/ เพื่อแก้ปัญหา Account Chooser และโหลดรูปได้โดยไม่ต้อง Login
export const processImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  if (url.includes('drive.google.com')) {
    let id = null;
    if (url.includes('id=')) {
      const match = url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) id = match[1];
    } else if (url.includes('/d/')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match) id = match[1];
    } else if (url.includes('uc?')) {
      const match = url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) id = match[1];
    }

    if (id) {
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
  }
  return url;
};

export const getFileId = (url) => {
  if (!url) return null;
  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

export const generateTrackingToken = (id, dateStr) => {
  if (!id || !dateStr) return id;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return id;

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + 543;
  const HH = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');

  return `${id}${dd}${mm}${yyyy}${HH}${mn}`;
};

export const getNowDateString = () => {
  const now = new Date();
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
};

export const formatDate = (isoString) => {
  if (!isoString) return "";
  const dateObj = new Date(isoString);
  if (isNaN(dateObj.getTime())) return "";

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear() + 543;
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export const formatPhoneNumber = (value) => {
  if (!value) return '';
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
  }
  return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export const renderDeliveryTime = (item) => {
  if (!item) return <span>-</span>;
  const start = formatDate(item.rawDeliveryStart);
  const end = formatDate(item.rawDeliveryEnd || item.rawDeliveryDateTime);

  if (item.rawDeliveryStart && (item.rawDeliveryEnd || item.rawDeliveryDateTime)) {
    return (
      <div className="flex flex-col">
        <span>{start}</span>
        <span>{end}</span>
      </div>
    );
  }
  return <span>{end || item.deliveryDate || '-'}</span>;
};

// Helper: Arabic Number to Thai Text
export const arabicNumberToText = (n) => {
  n = parseFloat(n);
  if (isNaN(n) || n === 0) return "ศูนย์บาทถ้วน";

  const nums = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  let nStr = n.toFixed(2).toString();
  let [integer, fraction] = nStr.split('.');
  let text = "";

  // Integer Part
  if (parseInt(integer) === 0) {
    text = "ศูนย์";
  } else {
    let len = integer.length;
    for (let i = 0; i < len; i++) {
      let digit = parseInt(integer.charAt(i));
      let pos = len - i - 1;
      let unitIndex = pos % 6;

      if (digit !== 0) {
        if (unitIndex === 0 && digit === 1 && i > 0 && parseInt(integer.charAt(i - 1)) !== 0) {
          text += "เอ็ด";
        } else if (unitIndex === 1 && digit === 2) {
          text += "ยี่";
        } else if (unitIndex === 1 && digit === 1) {
          // Sip (10)
        } else {
          text += nums[digit];
        }
        text += units[unitIndex];
      }

      if (pos > 0 && pos % 6 === 0) {
        text += "ล้าน";
      }
    }
  }

  text += "บาท";

  // Fraction Part (Satang)
  if (parseInt(fraction) === 0) {
    text += "ถ้วน";
  } else {
    if (parseInt(fraction) > 0) {
      let fLen = fraction.length;
      for (let i = 0; i < fLen; i++) {
        let digit = parseInt(fraction.charAt(i));
        let pos = fLen - i - 1;

        if (digit !== 0) {
          if (pos === 0 && digit === 1 && i > 0) {
            text += "เอ็ด";
          } else if (pos === 1 && digit === 2) {
            text += "ยี่";
          } else if (pos === 1 && digit === 1) {
            // Sip
          } else {
            text += nums[digit];
          }

          if (pos === 1) text += "สิบ";
        }
      }
      text += "สตางค์";
    }
  }
  return text;
};
