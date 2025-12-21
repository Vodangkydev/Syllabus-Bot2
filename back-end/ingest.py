import os
import shutil
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFDirectoryLoader, TextLoader
from langchain_core.documents import Document
from datetime import datetime

# Đường dẫn
DOCUMENTS_DIR = "./data"
CHROMA_DB_DIR = "./chroma_db"

def fetch_url_content(url):
    """Lấy nội dung từ URL"""
    try:
        # Validate URL
        parsed_url = urlparse(url)
        if not all([parsed_url.scheme, parsed_url.netloc]):
            print(f"URL không hợp lệ: {url}")
            return None

        # Add headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        # Add timeout and verify SSL
        response = requests.get(url, headers=headers, timeout=10, verify=True)
        response.raise_for_status()
        
        # Check content type
        content_type = response.headers.get('content-type', '').lower()
        if 'text/html' not in content_type:
            print(f"URL không phải là trang web HTML: {url}")
            return None

        # Parse HTML content
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
            
        # Get text content
        text = soup.get_text()
        
        # Clean up text
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        if not text.strip():
            print(f"Không tìm thấy nội dung văn bản từ URL: {url}")
            return None

        return text
    except requests.exceptions.Timeout:
        print(f"Timeout khi lấy nội dung từ URL {url}")
        return None
    except requests.exceptions.SSLError:
        print(f"Lỗi SSL khi lấy nội dung từ URL {url}")
        return None
    except requests.exceptions.ConnectionError:
        print(f"Lỗi kết nối khi lấy nội dung từ URL {url}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Lỗi khi lấy nội dung từ URL {url}: {e}")
        return None
    except Exception as e:
        print(f"Lỗi không xác định khi lấy nội dung từ URL {url}: {e}")
        return None

def create_document_from_url(url, name):
    """Tạo Document từ URL"""
    content = fetch_url_content(url)
    if content:
        return Document(
            page_content=content,
            metadata={
                "source": url,
                "url": url,  # Thêm trường url rõ ràng để dễ truy xuất
                "type": "url",
                "name": name,
                "content_type": "webpage",
                "domain": url.split('/')[2] if len(url.split('/')) > 2 else "unknown",
                "created_at": datetime.now().isoformat()
            }
        )
    return None

def create_embeddings():
    """Khởi tạo model embedding"""
    return HuggingFaceEmbeddings(
        model_name="dangvantuan/vietnamese-embedding",
        model_kwargs={'device': 'cpu'},
        encode_kwargs={'normalize_embeddings': True}
    )

def load_documents(urls=None):
    """Load tài liệu từ thư mục và URLs"""
    documents = []
    
    # Load từ URLs nếu có
    if urls:
        for name, url in urls.items():
            doc = create_document_from_url(url, name)
            if doc:
                documents.append(doc)
        print(f"Đã load {len(documents)} tài liệu từ URLs")
    
    # Load PDF
    try:
        pdf_loader = PyPDFDirectoryLoader(DOCUMENTS_DIR)
        documents.extend(pdf_loader.load())
        print(f"Đã load {len([d for d in documents if d.metadata.get('source', '').endswith('.pdf')])} tài liệu PDF")
    except Exception as e:
        print(f"Lỗi khi load PDF: {e}")

    # Load TXT
    try:
        for file in os.listdir(DOCUMENTS_DIR):
            if file.endswith('.txt'):
                file_path = os.path.join(DOCUMENTS_DIR, file)
                text_loader = TextLoader(file_path)
                documents.extend(text_loader.load())
        print(f"Đã load thêm {len([d for d in documents if d.metadata.get('source', '').endswith('.txt')])} tài liệu TXT")
    except Exception as e:
        print(f"Lỗi khi load TXT: {e}")

    return documents

def enhance_pdf_metadata(documents):
    """Cải thiện metadata cho PDF documents"""
    for doc in documents:
        if doc.metadata.get('source', '').endswith('.pdf'):
            filename = os.path.basename(doc.metadata.get('source', ''))
            
            # Thêm metadata hữu ích
            doc.metadata.update({
                "type": "pdf",
                "content_type": "document",
                "filename": filename,
                "file_extension": "pdf",
                "created_at": datetime.now().isoformat(),
                "is_syllabus": "syllabus" in filename.lower() or "ctdt" in filename.lower(),
                "subject": extract_subject_from_filename(filename)
            })
        # Đảm bảo URL được lưu trong metadata cho documents từ URL
        elif doc.metadata.get('type') == 'url':
            url = doc.metadata.get('source', '')
            if url and not doc.metadata.get('url'):
                doc.metadata['url'] = url
    return documents

def extract_subject_from_filename(filename):
    """Trích xuất tên môn học từ tên file"""
    filename_lower = filename.lower()
    
    # Mapping các từ khóa
    subject_mapping = {
        "python": "Lập trình Python",
        "java": "Lập trình Java", 
        "web": "Lập trình Web",
        "mobile": "Lập trình Mobile",
        "database": "Cơ sở dữ liệu",
        "network": "Mạng máy tính",
        "ai": "Trí tuệ nhân tạo",
        "ml": "Machine Learning",
        "data": "Khoa học dữ liệu",
        "software": "Kỹ thuật phần mềm",
        "testing": "Kiểm thử phần mềm",
        "ui": "Thiết kế giao diện",
        "ux": "Trải nghiệm người dùng",
        "oop": "Lập trình hướng đối tượng",
        "algorithm": "Thuật toán",
        "structure": "Cấu trúc dữ liệu"
    }
    
    for keyword, subject in subject_mapping.items():
        if keyword in filename_lower:
            return subject
    
    return "Môn học khác"

def split_documents(documents):
    """Chia tài liệu thành các đoạn nhỏ với metadata được cải thiện"""
    if not documents:
        return []
    
    # Cải thiện metadata trước khi chia
    documents = enhance_pdf_metadata(documents)
        
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=510,
        chunk_overlap=110
    )
    chunks = splitter.split_documents(documents)
    
    # Thêm chunk_id cho mỗi chunk và đảm bảo URL được giữ lại
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_id"] = f"chunk_{i:06d}"
        chunk.metadata["chunk_index"] = i
        chunk.metadata["total_chunks"] = len(chunks)
        # Đảm bảo URL được giữ lại sau khi chia (nếu có)
        if chunk.metadata.get('type') == 'url':
            url = chunk.metadata.get('source', '')
            if url and not chunk.metadata.get('url'):
                chunk.metadata['url'] = url
    
    print(f"Đã chia thành {len(chunks)} đoạn với metadata được cải thiện")
    return chunks

def create_vectorstore(chunks, embeddings):
    """Tạo vectorstore mới"""
    try:
        # Xóa vectorstore cũ
        if os.path.exists(CHROMA_DB_DIR):
            shutil.rmtree(CHROMA_DB_DIR)
            print("Đã xóa vectorstore cũ")

        # Tạo vectorstore mới
        vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=embeddings,
            persist_directory=CHROMA_DB_DIR
        )
        print("Đã tạo vectorstore mới")
        return vectorstore
    except Exception as e:
        print(f"Lỗi khi tạo vectorstore: {e}")
        return None

def print_sample_chunks(vectorstore, num_chunks=5):
    """In một số đoạn mẫu từ vectorstore với metadata đầy đủ"""
    try:
        chunks = vectorstore.similarity_search("", k=num_chunks)
        print(f"\n=== {len(chunks)} Đoạn Mẫu với Metadata ===\n")
        
        for i, chunk in enumerate(chunks, 1):
            # Hiển thị metadata đầy đủ
            metadata = chunk.metadata
            name = metadata.get('name', '')
            source = metadata.get('source', 'Unknown')
            doc_type = metadata.get('type', 'unknown')
            subject = metadata.get('subject', 'N/A')
            is_syllabus = metadata.get('is_syllabus', False)
            chunk_id = metadata.get('chunk_id', 'N/A')
            
            if name:
                display_name = name
            else:
                display_name = os.path.basename(source)
                
            print(f"\n--- {display_name} ---")
            print(f"Loại: {doc_type} | Môn học: {subject} | Syllabus: {is_syllabus}")
            print(f"Chunk ID: {chunk_id} | Nguồn: {source}")
            print(f"Đoạn {i}:")
            print(chunk.page_content[:200] + "...")
            print("-" * 50)
    except Exception as e:
        print(f"Lỗi khi in mẫu: {e}")

if __name__ == "__main__":
    try:
        # Khởi tạo embeddings
        embeddings = create_embeddings()
        
        # Danh sách URLs cần crawl (có thể thêm vào đây)
        urls = {
            "nganh_cong_nghe_thong_tin": "https://www.vlu.edu.vn/vi/academics/majors/cong-nghe-thong-tin",
            "lap_trinh_ung_dung_di_dong": "https://www.scribd.com/document/877694180/DCCT-LapTrinhUDDiDong-K29IT-ThanhTran",
            "kiem_thu_tu_dong_k27": "https://www.scribd.com/document/877671465/Ki%E1%BB%83m-Th%E1%BB%AD-T%E1%BB%B1-%C4%90%E1%BB%99ng-k27",
            "ban_mo_ta_ctdt_k27_cong_nghe_thong_tin": "https://fr.scribd.com/document/877673206/Banmota-CTDT-K27-CongngheThongtin?",
            "lap_trinh_python_nang_cao": "https://www.scribd.com/document/877687066/LAP-TRINH-PYTHON-NANGCAO",
            "Bong_ro": "https://fr.scribd.com/document/502728237/MA-U-%C4%90E-CU-O-NG-CHI-TIE-T-2021-Bo-ng-ro-chua-n-nha-t-1?",
             "Thiet_ke_giao_dien_nguoi_dung": "https://www.scribd.com/document/877753724/DCCT-ThietKeGiaoDien-K27IT-HK241-HoaDang",
              "lap_trinh_huong_doi_tuong": "https://fr.scribd.com/document/877754831/DCCT-LapTrinhHDT-K29-TanNguyen",
        }
        
        # Load và xử lý tài liệu
        documents = load_documents(urls)
        if not documents:
            print("Không có tài liệu nào được load")
            exit()
            
        # Chia tài liệu
        chunks = split_documents(documents)
        if not chunks:
            print("Không có đoạn nào được tạo")
            exit()
            
        # Tạo vectorstore
        vectorstore = create_vectorstore(chunks, embeddings)
        if vectorstore:
            print_sample_chunks(vectorstore)
            
    except Exception as e:
        print(f"Lỗi: {e}")
