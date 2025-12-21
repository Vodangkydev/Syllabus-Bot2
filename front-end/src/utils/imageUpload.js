import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const IMGBB_API_KEY = '31ea6c034edde799693f538c588315df'; // Thay thế bằng API key của bạn

export const uploadCompressedImage = async (
  imageFile,
  userId,
  onProgress = () => {},
  onPreview = () => {}
) => {
  try {
    // Tạo preview cho UI
    const previewUrl = URL.createObjectURL(imageFile);
    onPreview(previewUrl);
    onProgress(20);

    // Tạo FormData để upload
    const formData = new FormData();
    formData.append('image', imageFile);
    
    // Tải lên ImgBB
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Không thể tải ảnh lên ImgBB');
    }

    const data = await response.json();
    const imageUrl = data.data.url;
    onProgress(100);
    URL.revokeObjectURL(previewUrl);

    console.log('✅ Upload ảnh thành công:', imageUrl);
    return imageUrl;

  } catch (err) {
    console.error('❌ Lỗi upload ảnh:', err);
    throw new Error('Upload ảnh thất bại. Vui lòng thử lại.');
  }
};

export const generateFileName = () => Date.now() + '.jpg'; 