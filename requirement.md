# YÊU CẦU NGHIỆP VỤ – WEBSITE QUẢN LÝ TỜ TRÌNH

Website có thanh menu dọc bên trái gồm 3 chức năng:
1. Tờ trình.
2. Chức năng 2 (bổ sung sau).
3. Chức năng 3 (bổ sung sau).

## 1. Tờ trình

Chức năng Tờ trình gồm 3 khu vực:

### 1.1. Dữ liệu cố định

- Hiển thị dữ liệu cố định mặc định khi truy cập.
- Có nút quản lý dữ liệu ở góc trên bên phải.
- Cho phép thêm, xem, sửa, xóa dữ liệu cố định.
- Có thể lưu nhiều bộ dữ liệu và lựa chọn bộ dữ liệu muốn sử dụng.
- Dữ liệu được lưu lại để sử dụng cho những lần tạo tờ trình tiếp theo.
- Trường Họ và tên trong PDF được tự động lấy từ dữ liệu cố định đang chọn.

### 1.2. Nhập nội dung tờ trình

Gồm 3 phần:

**A. Nội dung đệ trình**
- Một ô Textarea để nhập nội dung.
- Cho phép nhập nhiều dòng.

**B. Đề nghị**
- Hiển thị mặc định một dòng nhập liệu.
- Mỗi dòng gồm: số thứ tự, ô nhập Text, nút tải hình ảnh, icon dấu (+) và nút xóa.
- Nhấn dấu (+) để thêm dòng mới bên dưới.
- Tự động đánh số thứ tự liên tục.
- Có thể thêm không giới hạn số dòng.
- Mỗi dòng có thể đính kèm một hình ảnh riêng, không bắt buộc.
- Khi xóa dòng, hệ thống tự động cập nhật lại số thứ tự.
- Giữ nguyên thứ tự các dòng khi xuất PDF.

**C. Lý do đề nghị**
- Một ô Textarea để nhập nội dung.
- Một ô tải hình ảnh, không bắt buộc.
- Cho phép xem trước, thay thế và xóa hình ảnh.

### 1.3. Dữ liệu mẫu

- Hiển thị danh sách nội dung mẫu để người dùng tái sử dụng.
- Mỗi dữ liệu mẫu có tên và nội dung.
- Cho phép thêm, xem, sửa và xóa dữ liệu mẫu.
- Có nút sao chép nội dung nhanh.
- Có thể phân loại và tìm kiếm dữ liệu mẫu.

## 2. Xem trước và xuất tờ trình

- Có chức năng xem trước tờ trình sau khi nhập dữ liệu.
- Có thể quay lại chỉnh sửa trước khi xuất.
- Xuất tài liệu dưới định dạng PDF.
- Sử dụng file PDF mẫu được cung cấp: `1662041361-HCM-FM45 - TO TRINH-DOAN THAM QUAN DAI HOC KIEN TRUC.pdf`.
- Tự động điền đúng dữ liệu vào các vị trí tương ứng:
  - Họ và tên: Dữ liệu cố định.
  - Nội dung đệ trình: Nội dung đã nhập.
  - Đề nghị: Toàn bộ danh sách đề nghị và hình ảnh tương ứng.
  - Lý do đề nghị: Nội dung và hình ảnh đã nhập.
- Giữ nguyên bố cục, định dạng và nội dung gốc của biểu mẫu.
- Tự động xử lý nội dung dài và nhiều hình ảnh, không để nội dung chồng lấn hoặc bị mất.

## 3. Lịch sử tờ trình

- Lưu lại các tờ trình đã tạo.
- Xem lại nội dung tờ trình cũ.
- Cho phép chỉnh sửa hoặc tạo bản mới từ tờ trình cũ.
- Cho phép tải lại file PDF đã xuất.