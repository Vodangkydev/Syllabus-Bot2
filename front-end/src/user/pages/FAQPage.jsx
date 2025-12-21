import React from "react";
import { useNavigate } from "react-router-dom";
import { IoClose } from "react-icons/io5"; // cài: npm i react-icons nếu chưa có

const dataFAQs = [
  [
    "Cách sử dụng Chatbot tra cứu môn học?",
    "Để sử dụng chatbot tra cứu môn học hiệu quả, bạn chỉ cần nhấn vào 'Chat Ngay' và đặt câu hỏi rõ ràng, đầy đủ như: Môn an ninh mạng có yêu cầu điều kiện tiên quyết gì không? hoặc Môn Lập trình web có bao nhiêu tín chỉ? Điều này giúp chatbot đưa ra câu trả lời chính xác. Tuy nhiên, trong một số trường hợp, câu trả lời có thể không hoàn toàn chính xác, vì vậy bạn nên kiểm chứng thông tin hoặc liên hệ hỗ trợ nếu cần thiết."
  ],
  [
    "Chatbot lấy thông tin môn học như thế nào?",
    "Chatbot sử dụng trí tuệ nhân tạo để trích xuất thông tin từ các tài liệu pdf, txt, xlsx, v.v. Liên quan đến môn học, được lưu trữ trong hệ thống của trường. Những tài liệu này có thể bao gồm đề cương, kế hoạch giảng dạy, thông báo từ khoa, v.v. Thông tin được xử lý và phân tích để cung cấp câu trả lời phù hợp nhất với câu hỏi của bạn."
  ],
  [
    "Hỗ trợ & Liên hệ",
    "Nếu bạn gặp sự cố khi sử dụng chatbot, hoặc cần hỗ trợ thêm, bạn có thể:<br /> - Liên hệ với bộ phận kỹ thuật qua email: support@vlu.edu.vn<br /> - Hoặc đến trực tiếp Phòng Công nghệ thông tin tại tầng 5.18 (toà A) trong giờ hành chính.<br /> Chatbot chỉ hỗ trợ một phần thông tin tự động. Với những vấn đề phức tạp hơn, bạn nên liên hệ trực tiếp để được hỗ trợ kịp thời."
  ],
  [
    "Tại sao Chatbot không trả lời đúng câu hỏi của tôi?",
    "Có một vài lý do khiến chatbot có thể trả lời không chính xác:<br /> - Câu hỏi chưa rõ ràng hoặc quá chung chung → Bạn nên đặt câu hỏi cụ thể hơn.<br /> - Thông tin bạn hỏi chưa có trong tài liệu → Chatbot chỉ biết những gì đã được 'học' từ các tài liệu PDF có trong hệ thống.<br /> - Ngôn ngữ viết không chuẩn hoặc nhiều lỗi chính tả → Điều này có thể khiến chatbot hiểu sai nội dung. <br />👉 Bạn có thể thử đặt lại câu hỏi hoặc liên hệ bộ phận hỗ trợ để được giải đáp rõ hơn."
  ]
];

function FAQPage() {
  const navigate = useNavigate();

  return (
    <div
      className="relative flex justify-center items-center min-h-[100vh] h-auto transition-colors duration-300"
      style={{
        backgroundColor: document.documentElement.classList.contains('dark') ? '#171717' : '#F9F9F9',
        color: 'var(--text-primary)'
      }}
    >
      {/* Nút X */}
      <button
        className="absolute top-5 right-5 text-2xl text-gray-500 dark:text-gray-300 hover:text-red-500 border-2 border-white rounded-full p-2 bg-transparent transition-colors duration-200"
        onClick={() => navigate("/chat")}
        title="Quay lại Chat"
      >
        <IoClose />
      </button>

      <div
        className="w-full max-w-5xl max-h-2xl mx-auto rounded-3xl shadow-lg border py-6 px-8"
        style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#212121' : '#FFFFFF' }}
      >
        <h1 className="text-3xl text-center pt-6 pb-4 text-black dark:text-white">
          Những câu hỏi thường gặp
        </h1>
        {
          dataFAQs.map((item, i) => (
            <div
              key={i}
              className="mt-2 collapse collapse-plus shadow-md rounded-xl transition-all duration-300 border border-white dark:border-gray-700"
              style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#212121' : '#FFFFFF', color: 'var(--text-primary)' }}
            >
              <input type="checkbox" />
              <div className="collapse-title text-base font-semibold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200">
                {item[0]}
              </div>
              <div className="collapse-content">
                <p dangerouslySetInnerHTML={{ __html: item[1] }} />
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

export default FAQPage; 