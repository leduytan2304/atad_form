# YÊU CẦU NGHIỆP VỤ: HIỂN THỊ SẢN PHẨM, LỰA CHỌN QUÀ TẶNG VÀ LẬP TỜ TRÌNH

## 1. Hiển thị danh sách sản phẩm tại giao diện `/feature-2`

Tôi muốn điều chỉnh cách hiển thị danh sách sản phẩm với các yêu cầu sau:

- Hiển thị toàn bộ sản phẩm, bao gồm cả những sản phẩm có tổng số lượng tồn kho bằng 0 hoặc nhỏ hơn 0.
- Không được tự động ẩn hoặc loại bỏ sản phẩm chỉ vì sản phẩm đã hết hàng hoặc có tồn kho âm.
- Đối với sản phẩm còn hàng (tổng tồn kho lớn hơn 0), giữ nguyên cách hiển thị hiện tại.
- Đối với sản phẩm có tổng tồn kho bằng 0 hoặc nhỏ hơn 0, hãy làm tối màu nền sản phẩm hơn một chút so với những sản phẩm còn hàng để người dùng dễ dàng phân biệt.
- Các sản phẩm hết hàng hoặc tồn kho âm vẫn phải hiển thị đầy đủ thông tin để người dùng tham khảo, nhưng không được phép lựa chọn.

## 2. Quy tắc lựa chọn sản phẩm

Bổ sung khả năng cho phép người dùng lựa chọn nhiều sản phẩm cùng lúc.

Các quy tắc nghiệp vụ:

- Chỉ những sản phẩm có tổng tồn kho lớn hơn 0 mới được phép lựa chọn.
- Sản phẩm có tổng tồn kho bằng 0 hoặc nhỏ hơn 0 phải ở trạng thái không thể lựa chọn.
- Những sản phẩm không thể lựa chọn cần có dấu hiệu trực quan rõ ràng để người dùng nhận biết.
- Người dùng có thể lựa chọn nhiều sản phẩm cùng lúc để đưa vào một tờ trình.
- Khi sản phẩm được lựa chọn, cần có dấu hiệu trực quan để phân biệt với những sản phẩm chưa được lựa chọn.
- Người dùng có thể bỏ lựa chọn bất kỳ sản phẩm nào.
- Khi người dùng bỏ chọn một sản phẩm, sản phẩm đó phải tự động bị loại khỏi danh sách quà tặng trong giao diện lập tờ trình.
- Danh sách sản phẩm đã chọn phải được đồng bộ chính xác với danh sách quà tặng trong quá trình lập tờ trình.
- Không được xuất hiện tình trạng sản phẩm đã bỏ chọn nhưng vẫn còn trong bảng tờ trình.

## 3. Chức năng "Làm Tờ Trình"

Bổ sung một nút có tên chính xác là "Làm Tờ Trình" tại giao diện `/feature-2`.

Khi người dùng đã lựa chọn một hoặc nhiều sản phẩm và nhấn nút này, hệ thống sẽ mở giao diện lập tờ trình.

Nếu chưa có sản phẩm nào được lựa chọn, không cho phép tiếp tục lập tờ trình và cần hiển thị thông báo hướng dẫn người dùng lựa chọn sản phẩm trước.

Giao diện lập tờ trình gồm hai phần chính:

### 3.1. Thông tin chung

Hiển thị lần lượt ba trường thông tin:

1. Thông tin đoàn.
2. Thời gian.
3. Địa điểm.

Cả ba trường đều do người dùng chủ động nhập.

Các thông tin này sẽ được sử dụng trong nội dung tờ trình.

### 3.2. Bảng danh sách quà tặng

Hiển thị một bảng gồm chính xác 5 cột:

| No | Quà Tặng | Hình Quà | Đơn vị tính | Số Lượng |
|---|---|---|---|---|
| 1 | Tên sản phẩm A | Hình ảnh A | Dropdown | Người dùng nhập |
| 2 | Tên sản phẩm B | Hình ảnh B | Dropdown | Người dùng nhập |
| 3 | Tên sản phẩm C | Hình ảnh C | Dropdown | Người dùng nhập |

Quy tắc hiển thị:

- Chỉ hiển thị những sản phẩm người dùng đã lựa chọn trước đó.
- Tên quà tặng tự động lấy từ tên sản phẩm.
- Hình quà tự động lấy từ hình ảnh tương ứng của sản phẩm.
- Đơn vị tính là trường do người dùng tự lựa chọn thông qua Dropdown.
- Số lượng do người dùng tự nhập.
- Số thứ tự No tự động đánh số lần lượt từ 1.

Người dùng có thể thay đổi số lượng và đơn vị tính của từng sản phẩm trước khi xem trước tờ trình.

## 4. Nghiệp vụ quản lý đơn vị tính

Tôi muốn có một chức năng quản lý danh sách đơn vị tính riêng biệt để sử dụng trong quá trình lập tờ trình.

### 4.1. Quản lý danh sách đơn vị tính

- Danh sách đơn vị tính phải được quản lý độc lập với danh sách sản phẩm.
- Người dùng có thể thêm đơn vị tính mới.
- Người dùng có thể chỉnh sửa tên đơn vị tính.
- Người dùng có thể xóa đơn vị tính không còn sử dụng.
- Danh sách đơn vị tính phải được lưu trữ lâu dài và sử dụng lại được trong những lần lập tờ trình tiếp theo.
- Không được tạo lại danh sách đơn vị tính mỗi khi người dùng mở giao diện lập tờ trình.
- Cần kiểm tra trùng lặp để tránh tạo nhiều đơn vị tính có cùng tên.

### 4.2. Sử dụng Dropdown đơn vị tính trong bảng quà tặng

Tại mỗi hàng sản phẩm, cột Đơn vị tính phải là một Dropdown.

Quy tắc hoạt động:

- Khi người dùng nhấn vào Dropdown, hiển thị danh sách các đơn vị tính đã được tạo trước đó.
- Mỗi hàng chỉ được phép chọn duy nhất một đơn vị tính.
- Mỗi sản phẩm có thể sử dụng một đơn vị tính khác nhau.
- Việc thay đổi đơn vị tính của một sản phẩm không được ảnh hưởng đến đơn vị tính của các sản phẩm khác.
- Nếu danh sách chưa có đơn vị tính phù hợp, người dùng có thể thêm đơn vị tính mới vào danh sách quản lý.
- Sau khi thêm mới thành công, đơn vị tính đó phải xuất hiện trong Dropdown để người dùng lựa chọn.
- Đơn vị tính đã lựa chọn phải được giữ nguyên khi người dùng chuyển sang bước xem trước và quay lại chỉnh sửa.

Lưu ý: Việc quản lý đơn vị tính là một nghiệp vụ riêng. Không được mặc định lấy đơn vị tính từ thông tin sản phẩm.

## 5. Chức năng nhập số lượng

- Người dùng chủ động nhập số lượng quà tặng cho từng sản phẩm.
- Mỗi sản phẩm có một trường nhập số lượng độc lập.
- Số lượng phải là số nguyên dương.
- Không chấp nhận số lượng bằng 0, số âm hoặc giá trị không hợp lệ.
- Người dùng phải nhập số lượng cho tất cả sản phẩm trước khi xem trước tờ trình.
- Việc nhập số lượng trong tờ trình không được tự động làm thay đổi số lượng tồn kho.
- Không tự động thực hiện nghiệp vụ xuất kho hoặc trừ kho khi lập tờ trình.

## 6. Chức năng xem trước tờ trình

Bổ sung nút "Xem trước tờ trình".

Khi người dùng nhấn nút này:

- Kiểm tra thông tin đoàn, thời gian và địa điểm.
- Kiểm tra tất cả sản phẩm trong bảng quà tặng.
- Kiểm tra mỗi sản phẩm đã có đơn vị tính hay chưa.
- Kiểm tra số lượng đã được nhập hợp lệ hay chưa.
- Nếu thiếu thông tin hoặc có dữ liệu không hợp lệ, hiển thị thông báo cụ thể để người dùng biết cần chỉnh sửa ở đâu.
- Nếu tất cả thông tin hợp lệ, hiển thị bản xem trước tờ trình hoàn chỉnh.

Bản xem trước phải thể hiện đầy đủ:

- Thông tin đoàn.
- Thời gian.
- Địa điểm.
- Danh sách quà tặng.
- Hình ảnh từng món quà.
- Đơn vị tính.
- Số lượng.

Nội dung bản xem trước phải phản ánh chính xác dữ liệu người dùng đã nhập.

Người dùng có thể quay lại chỉnh sửa thông tin mà không bị mất dữ liệu đã nhập trước đó.

## 7. Chức năng tải tờ trình xuống

Bổ sung nút "Tải tờ trình xuống".

Khi người dùng nhấn nút này:

- Xuất nội dung tờ trình thành file hình ảnh.
- Hình ảnh tải xuống phải có nội dung và bố cục thống nhất với bản xem trước.
- Hình ảnh phải rõ nét, dễ đọc, phù hợp để lưu trữ, chia sẻ hoặc in ra.
- Nếu nội dung tờ trình dài hơn một trang, tự động chia thành nhiều trang thay vì thu nhỏ nội dung khiến chữ khó đọc.
- Không được thiếu sản phẩm, hình ảnh, đơn vị tính hoặc số lượng trong file xuất ra.
- Đặt tên file có ý nghĩa và dễ nhận biết.

## 8. Các nguyên tắc nghiệp vụ quan trọng

1. Tất cả sản phẩm đều phải được hiển thị, kể cả sản phẩm hết hàng hoặc tồn kho âm.
2. Chỉ cho phép lựa chọn sản phẩm có tổng tồn kho lớn hơn 0.
3. Người dùng được phép lựa chọn nhiều sản phẩm cùng lúc.
4. Khi bỏ chọn sản phẩm, sản phẩm đó phải tự động bị loại khỏi danh sách lập tờ trình.
5. Đơn vị tính được quản lý độc lập, có thể thêm, sửa và xóa.
6. Mỗi hàng sản phẩm trong tờ trình chỉ được lựa chọn một đơn vị tính.
7. Đơn vị tính đã tạo phải được lưu lại để tái sử dụng.
8. Số lượng quà tặng do người dùng chủ động nhập.
9. Lập tờ trình không đồng nghĩa với xuất kho hoặc xác nhận cấp phát quà tặng.
10. Không được tự động thay đổi tồn kho trong toàn bộ quy trình lập, xem trước và tải tờ trình.
11. Dữ liệu đã nhập phải được bảo toàn khi chuyển đổi giữa các bước.
12. Bản xem trước và file tải xuống phải thống nhất hoàn toàn về nội dung.

## 9. Tiêu chí nghiệm thu

Chức năng được xem là hoàn thành khi đáp ứng đầy đủ các trường hợp sau:

- Sản phẩm tồn kho dương, bằng 0 và âm đều được hiển thị.
- Sản phẩm tồn kho bằng 0 hoặc âm không thể lựa chọn.
- Người dùng có thể chọn nhiều sản phẩm còn hàng cùng lúc.
- Người dùng có thể bỏ chọn sản phẩm và sản phẩm đó tự động biến mất khỏi danh sách lập tờ trình.
- Nút "Làm Tờ Trình" hoạt động đúng theo danh sách sản phẩm đã chọn.
- Thông tin đoàn, thời gian và địa điểm được nhập chính xác.
- Bảng quà tặng hiển thị đúng 5 cột theo yêu cầu.
- Dropdown đơn vị tính hoạt động độc lập trên từng hàng.
- Người dùng có thể thêm, sửa và xóa đơn vị tính.
- Đơn vị tính được lưu lại và tái sử dụng trong các lần lập tờ trình sau.
- Người dùng có thể nhập số lượng cho từng sản phẩm.
- Hệ thống kiểm tra đầy đủ dữ liệu trước khi cho phép xem trước.
- Bản xem trước hiển thị đúng nội dung.
- Người dùng có thể tải tờ trình thành file hình ảnh.
- Không phát sinh thay đổi tồn kho ngoài ý muốn.

Hãy ưu tiên tính chính xác của nghiệp vụ, sự nhất quán dữ liệu và trải nghiệm sử dụng. Không tự ý thay đổi những nghiệp vụ hiện tại không liên quan đến yêu cầu này.