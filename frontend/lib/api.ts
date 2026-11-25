export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type ProfileSet = {
  id: number;
  name: string;
  full_name: string;
  position: string;
  department: string;
  document_number: string;
  document_date: string;
  reference: string;
  is_active: boolean;
  created_at: string;
};

export type ProfileInput = Omit<ProfileSet, "id" | "is_active" | "created_at"> & {
  is_active?: boolean;
};

export type ContentTemplate = {
  id: number;
  name: string;
  category: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type RequestItem = {
  text: string;
  image_id: number | null;
};

export type UploadedImage = {
  id: number;
  url: string;
  original_name: string;
};

export type Submission = {
  id: number;
  title: string;
  profile_id: number | null;
  profile_name: string;
  full_name: string;
  position: string;
  department: string;
  document_number: string;
  document_date: string;
  reference: string;
  content: string;
  requests: RequestItem[];
  reason: string;
  reason_image_id: number | null;
  docx_path: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionInput = Omit<
  Submission,
  "id" | "docx_path" | "created_at" | "updated_at"
>;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "Có lỗi xảy ra, vui lòng thử lại.";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail) && data.detail[0]?.msg) message = data.detail[0].msg;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  profiles: {
    list: () => request<ProfileSet[]>("/api/profiles"),
    create: (data: ProfileInput) =>
      request<ProfileSet>("/api/profiles", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<ProfileInput>) =>
      request<ProfileSet>(`/api/profiles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/profiles/${id}`, { method: "DELETE" }),
    activate: (id: number) => request<ProfileSet>(`/api/profiles/${id}/activate`, { method: "POST" }),
  },
  templates: {
    list: (q = "", category = "") => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      const query = params.toString();
      return request<ContentTemplate[]>(`/api/templates${query ? `?${query}` : ""}`);
    },
    categories: () => request<string[]>("/api/templates/categories"),
    create: (data: { name: string; category: string; content: string }) =>
      request<ContentTemplate>("/api/templates", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: string; category: string; content: string }>) =>
      request<ContentTemplate>(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/templates/${id}`, { method: "DELETE" }),
  },
  submissions: {
    list: () => request<Submission[]>("/api/submissions"),
    get: (id: number) => request<Submission>(`/api/submissions/${id}`),
    create: (data: SubmissionInput) =>
      request<Submission>("/api/submissions", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: SubmissionInput) =>
      request<Submission>(`/api/submissions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    duplicate: (id: number) =>
      request<Submission>(`/api/submissions/${id}/duplicate`, { method: "POST" }),
    remove: (id: number) => request<void>(`/api/submissions/${id}`, { method: "DELETE" }),
    docxUrl: (id: number, download = false) =>
      `${API_URL}/api/submissions/${id}/docx?download=${download}`,
    docxBlob: async (id: number) => {
      const response = await fetch(`${API_URL}/api/submissions/${id}/docx?download=false`);
      if (!response.ok) {
        let message = "Không tạo được file DOCX";
        try {
          const data = await response.json();
          if (typeof data.detail === "string") message = data.detail;
        } catch {
          /* giữ thông báo mặc định */
        }
        throw new Error(`${message} (mã ${response.status})`);
      }
      return response.blob();
    },
  },
  uploads: {
    create: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<UploadedImage>("/api/uploads", { method: "POST", body: form });
    },
    get: (id: number) => request<UploadedImage>(`/api/uploads/id/${id}`),
    remove: (id: number) =>
      request<{ deleted: boolean; reason: string }>(`/api/uploads/${id}`, { method: "DELETE" }),
    url: (path: string) => (path.startsWith("http") ? path : `${API_URL}${path}`),
  },
};
