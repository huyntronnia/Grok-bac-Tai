# Vidora

Ứng dụng Electron tự động hóa luồng tạo keyframe và motion prompt qua ChatGPT, sau đó chuyển sang VeoUp khi chế độ video được bật.

## Cài từ bản portable Windows

1. Giải nén toàn bộ `vidora-windows-portable.zip` vào một thư mục riêng.
2. Chạy `Vidora.exe` trong thư mục vừa giải nén.
3. Khi Windows hỏi quyền mạng hoặc cảnh báo ứng dụng chưa ký, chỉ tiếp tục nếu file đến từ gói bàn giao này.

`ffmpeg.exe` đã nằm trong `resources/`; không cần cài FFmpeg riêng.

## Chạy từ source trên Windows

Yêu cầu Node.js LTS và npm:

```powershell
npm ci
npm test
npm start
```

Tạo installer NSIS trên Windows:

```powershell
npm run dist
```

## Project `.vdra`

Khi tạo project `Demo` tại `D:\Projects`, Vidora tạo:

```text
D:\Projects\Demo.vdra
D:\Projects\Demo\
```

Folder output chứa `preprompt\`, các folder `scene_XXX\` và checkpoint pipeline. Vidora autosave `.vdra` sau khoảng 1 giây, lưu ngay ở checkpoint và trước khi đóng. App tự mở project gần nhất ở lần chạy tiếp theo nhưng luôn đợi người dùng bấm Start.

Nếu `Demo.vdra` hoặc folder `Demo\` đã tồn tại, Vidora từ chối tạo và yêu cầu tên khác; dữ liệu cũ không bị ghi đè.

## Luồng ChatGPT

Chat mới/rỗng chạy đúng thứ tự:

```text
Request 1 -> Request 2 -> NV1 -> lưu keyframe -> upload keyframe + NV2
-> lưu motion prompt -> NV1 scene tiếp theo -> ...
```

Phục hồi chỉ F5 đúng chat hiện tại và kiểm tra conversation ID; pipeline không chọn chat ở sidebar hay điều hướng sang URL chat khác. Với run dài, Vidora refresh đúng conversation hiện tại sau mỗi 5 scene ChatGPT hoàn tất để giải phóng tài nguyên trang, không tự tạo chat mới. Nếu ChatGPT virtualize DOM làm chỉ số image-turn cũ vượt quá số turn đang mount, Vidora chỉ rebase tới image card nằm sau đúng NV1 user turn và có ownership hash hợp lệ. Ảnh keyframe được giữ bằng đường dẫn file trên đĩa thay vì nhúng base64 vào state/IPC. Sau hai chu kỳ phục hồi scene không thành công, app lưu checkpoint và dừng an toàn.
