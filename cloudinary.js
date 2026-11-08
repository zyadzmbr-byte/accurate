import { cloudinaryConfig } from './config.js';

/**
 * Uploads a file directly to Cloudinary using unsigned upload preset
 * @param {File} file - File object to upload
 * @param {Function} [onProgress] - Optional callback(percent: number)
 * @returns {Promise<Object>} Upload response metadata
 */
export async function uploadToCloudinary(file, onProgress = null) {
  if (!file) {
    throw new Error('يرجى تحديد ملف للرفع');
  }

  // Validate allowed file types (Images & PDFs/Docs)
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('نوع الملف غير مدعوم. يرجى رفع صورة (JPG, PNG, WebP) أو ملف PDF');
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  formData.append('folder', 'accurate_lab');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', cloudinaryConfig.uploadUrl, true);

    // Track upload progress
    if (xhr.upload && typeof onProgress === 'function') {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            url: response.secure_url || response.url,
            secure_url: response.secure_url,
            public_id: response.public_id,
            format: response.format,
            width: response.width,
            height: response.height,
            bytes: response.bytes,
            created_at: response.created_at,
            original_filename: response.original_filename
          });
        } catch (e) {
          reject(new Error('فشل معالجة استجابة الخادم'));
        }
      } else {
        let errorMsg = 'حدث خطأ أثناء رفع الملف إلى Cloudinary';
        try {
          const errRes = JSON.parse(xhr.responseText);
          if (errRes.error && errRes.error.message) {
            errorMsg = errRes.error.message;
          }
        } catch (_) {}
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('تعذر الاتصال بخادم الرفع. يرجى التحقق من اتصال الإنترنت'));
    };

    xhr.send(formData);
  });
}

/**
 * Generates an optimized Cloudinary delivery URL with auto format and quality
 * @param {string} url - Original Cloudinary image URL
 * @param {number} [width] - Desired display width
 * @returns {string} Optimized URL
 */
export function getOptimizedImageUrl(url, width = null) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return url;
  }
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) return url;

  let transformations = 'f_auto,q_auto';
  if (width) {
    transformations += `,w_${width},c_limit`;
  }

  return url.replace('/upload/', `/upload/${transformations}/`);
}

