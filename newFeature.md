# YÊU CẦU NGHIỆP VỤ: TRA CỨU SẢN PHẨM VÀ TỒN KHO TỪ FILE EXCEL

## 1. Mục tiêu

Xây dựng một giao diện tra cứu sản phẩm và số lượng tồn kho dựa trên dữ liệu từ file Excel/Google Sheets được cung cấp.

Hệ thống cần tự động đọc cấu trúc bảng tính, nhận diện tên sản phẩm, hình ảnh tương ứng và kiểm tra số lượng tồn kho tại từng văn phòng. Chỉ hiển thị những sản phẩm đang có số lượng tồn kho lớn hơn 0.

## 2. Đọc và phân tích cấu trúc file Excel

- Đọc toàn bộ dữ liệu trong file Excel được cung cấp.
- Tại hàng thứ 2 (A2), tiến hành kiểm tra lần lượt các ô từ trái sang phải, bắt đầu từ cột A.
- Tiếp tục cho đến khi không còn tìm thấy ô có dữ liệu hoặc cấu trúc khác biệt so với các ô Excel thông thường.
- Các ô tại hàng thứ 2 có thể chứa hình ảnh được chèn trực tiếp vào bảng tính thay vì dữ liệu văn bản.
- Cần nhận diện được cả hình ảnh và vị trí của hình ảnh trong bảng tính.
- Xác định tên sản phẩm tương ứng với từng hình ảnh dựa trên nội dung và vị trí các ô trong bảng tính.
- Không được bỏ qua hình ảnh chỉ vì chúng không được lưu dưới dạng nội dung văn bản của ô Excel.
- Mỗi hình ảnh phải được liên kết chính xác với tên sản phẩm tương ứng, không nhầm lẫn giữa các sản phẩm.

## 3. Xác định dữ liệu sản phẩm và số lượng tồn kho

Sau khi xác định được danh sách sản phẩm tại hàng thứ 2, cần kiểm tra dữ liệu tồn kho của từng sản phẩm.

Nguyên tắc xác định:

- Mỗi sản phẩm tương ứng với một cột dữ liệu riêng.
- Tên sản phẩm được xác định từ hàng thứ 2.
- Tiến hành duyệt toàn bộ dữ liệu trong cột tương ứng với sản phẩm đó để tìm số lượng tồn kho.
- Không chỉ kiểm tra một ô hoặc một dòng cố định.
- Xác định tên văn phòng tương ứng với từng số lượng tồn kho.
- Tổng hợp dữ liệu theo từng sản phẩm và từng văn phòng.

**Ví dụ:**

Nếu sản phẩm có tên là "TÚI KRAFT" nằm tại cột E:

1. Xác định hình ảnh và tên sản phẩm TÚI KRAFT tại hàng thứ 2.
2. Duyệt toàn bộ cột E để tìm dữ liệu tồn kho.
3. Xác định những dòng có số lượng TÚI KRAFT lớn hơn 0.
4. Trích xuất tên văn phòng tương ứng với từng dòng.
5. Chỉ đưa những dòng có số lượng lớn hơn 0 vào danh sách hiển thị.

Áp dụng nguyên tắc tương tự cho tất cả các sản phẩm khác được tìm thấy tại hàng thứ 2.

## 4. Quy tắc hiển thị sản phẩm

Chỉ hiển thị những sản phẩm có số lượng tồn kho lớn hơn 0.

- Nếu sản phẩm có số lượng bằng 0: Không hiển thị.
- Nếu sản phẩm có số lượng âm: Không hiển thị.
- Nếu sản phẩm không có dữ liệu tồn kho: Không hiển thị.
- Nếu một sản phẩm có tồn kho tại nhiều văn phòng: Hiển thị đầy đủ từng văn phòng tương ứng.
- Nếu một sản phẩm không còn tồn kho tại bất kỳ văn phòng nào: Không xuất hiện trong danh sách.

Lưu ý: Không được cộng gộp số lượng giữa các văn phòng thành một dòng duy nhất, vì cần biết chính xác sản phẩm đang còn ở văn phòng nào.

## 5. Giao diện hiển thị

Thiết kế giao diện tra cứu tồn kho rõ ràng, dễ nhìn và thuận tiện cho việc kiểm tra sản phẩm.

Hiển thị dữ liệu dưới dạng bảng với chính xác 4 cột:

| Tên sản phẩm | Hình ảnh | Tên văn phòng | Số lượng |
|---|---|---|---|
| TÚI KRAFT | Hình ảnh sản phẩm | Văn phòng A | 120 |
| TÚI KRAFT | Hình ảnh sản phẩm | Văn phòng B | 50 |
| BÌA HỒ SƠ | Hình ảnh sản phẩm | Văn phòng A | 30 |

Yêu cầu giao diện:

- Tên sản phẩm phải hiển thị chính xác theo file Excel.
- Hình ảnh phải đúng với sản phẩm tương ứng.
- Hình ảnh cần hiển thị rõ ràng, không bị méo hoặc mất tỷ lệ.
- Tên văn phòng phải chính xác theo dữ liệu nguồn.
- Số lượng phải được hiển thị rõ ràng, dễ đọc.
- Một sản phẩm có nhiều văn phòng tồn kho thì hiển thị thành nhiều dòng, mỗi dòng tương ứng với một văn phòng.
- Không hiển thị những dòng có số lượng tồn kho bằng 0 hoặc nhỏ hơn 0.

## 6. Yêu cầu về độ chính xác dữ liệu

Đây là yêu cầu quan trọng nhất:

- Không tự suy đoán tên sản phẩm hoặc tên văn phòng.
- Không tự tạo hình ảnh thay thế cho hình ảnh trong Excel.
- Không ghép nhầm hình ảnh giữa các sản phẩm.
- Không bỏ sót các cột sản phẩm được khai báo tại hàng thứ 2.
- Phải kiểm tra toàn bộ dữ liệu tồn kho trong cột tương ứng.
- Không làm thay đổi số lượng tồn kho gốc.
- Mọi dữ liệu hiển thị phải có nguồn gốc từ file Excel được cung cấp.

**Kết quả mong muốn:** Khi mở giao diện, người dùng có thể nhìn thấy danh sách tất cả sản phẩm đang còn tồn kho, kèm hình ảnh, tên văn phòng và số lượng chính xác được lấy trực tiếp từ file Excel.