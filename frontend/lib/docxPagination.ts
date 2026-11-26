/**
 * docx-preview chỉ ngắt trang tại các page break thủ công, không tự phân trang
 * theo chiều cao nội dung. Vì vậy một tờ trình dài sẽ hiển thị thành một "trang"
 * kéo dài trong khi Word chia thành nhiều trang. Hàm dưới đây chia lại nội dung
 * theo đúng khổ giấy/lề của DOCX và đánh lại số trang ở footer.
 */

const OVERFLOW_TOLERANCE = 0.5;

function toPx(value: string | null | undefined): number {
  if (!value) return 0;
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return 0;
  return value.trim().endsWith("pt") ? (amount * 96) / 72 : amount;
}

function collectTextNodes(root: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue) nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

function locate(nodes: Text[], offset: number): [Text, number] {
  let consumed = 0;
  for (const node of nodes) {
    const length = node.nodeValue?.length ?? 0;
    if (offset <= consumed + length) return [node, offset - consumed];
    consumed += length;
  }
  const last = nodes[nodes.length - 1];
  return [last, last.nodeValue?.length ?? 0];
}

/**
 * Tách đoạn văn tại ranh giới dòng cuối còn nằm trong trang.
 * Trả về đoạn nối tiếp (phần tràn sang trang sau) hoặc null nếu không tách được.
 */
function splitParagraphAtLimit(
  paragraph: HTMLElement,
  limit: number,
  articleTop: number,
): HTMLElement | null {
  const nodes = collectTextNodes(paragraph);
  if (!nodes.length) return null;

  const text = nodes.map((node) => node.nodeValue ?? "").join("");
  if (!text.length) return null;

  let low = 0;
  let high = text.length;
  let best = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [node, offset] = locate(nodes, middle);
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.setEnd(node, offset);
    const bottom = range.getBoundingClientRect().bottom - articleTop;
    if (bottom <= limit + OVERFLOW_TOLERANCE) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (best <= 0) return null;

  // Ngắt tại khoảng trắng gần nhất để không cắt giữa từ.
  let split = best;
  const space = text.lastIndexOf(" ", split - 1);
  if (space > 0) split = space + 1;
  if (split <= 0 || split >= text.length) return null;

  const [startNode, startOffset] = locate(nodes, split);
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(paragraph, paragraph.childNodes.length);

  const fragment = range.extractContents();
  const continuation = paragraph.cloneNode(false) as HTMLElement;
  continuation.appendChild(fragment);
  // Dòng tiếp nối của cùng đoạn văn không thụt đầu dòng.
  continuation.style.textIndent = "0";
  return continuation;
}

function paginatePage(page: HTMLElement): HTMLElement | null {
  const article = page.querySelector<HTMLElement>(":scope > article");
  if (!article) return null;

  const pageHeight = toPx(page.style.minHeight) || page.getBoundingClientRect().height;
  const pageStyle = getComputedStyle(page);
  const paddingTop = Number.parseFloat(pageStyle.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(pageStyle.paddingBottom) || 0;
  const pageRect = page.getBoundingClientRect();
  const articleRect = article.getBoundingClientRect();
  const contentTop = articleRect.top - (pageRect.top + paddingTop);
  const limit = pageHeight - paddingTop - paddingBottom - contentTop;
  if (limit <= 0) return null;

  const children = Array.from(article.children) as HTMLElement[];
  let splitIndex = -1;
  let straddles = false;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    const rect = child.getBoundingClientRect();
    const marginBottom = Number.parseFloat(getComputedStyle(child).marginBottom) || 0;
    if (rect.bottom - articleRect.top + marginBottom > limit + OVERFLOW_TOLERANCE) {
      splitIndex = index;
      straddles = rect.top - articleRect.top < limit - 2;
      break;
    }
  }
  if (splitIndex < 0) return null;

  const nextPage = page.cloneNode(true) as HTMLElement;
  const nextArticle = nextPage.querySelector<HTMLElement>(":scope > article");
  if (!nextArticle) return null;
  nextArticle.replaceChildren();

  const overflow = children[splitIndex];
  const continuation =
    straddles && overflow.tagName === "P"
      ? splitParagraphAtLimit(overflow, limit, articleRect.top)
      : null;

  if (continuation) {
    nextArticle.appendChild(continuation);
    for (const child of children.slice(splitIndex + 1)) nextArticle.appendChild(child);
  } else {
    // Không tách được phần tử đầu tiên (ảnh/bảng quá cao): giữ nguyên để tránh lặp vô hạn.
    if (splitIndex === 0) return null;
    for (const child of children.slice(splitIndex)) nextArticle.appendChild(child);
  }

  page.after(nextPage);
  return nextPage;
}

function updatePageNumbers(pages: HTMLElement[]): void {
  const total = pages.length;
  pages.forEach((page, index) => {
    const footer = page.querySelector("footer");
    if (!footer) return;
    const numbers = Array.from(footer.querySelectorAll("span")).filter(
      (span) =>
        !span.querySelector("span") && /^\d+$/.test((span.textContent ?? "").trim()),
    );
    if (numbers.length >= 2) {
      numbers[numbers.length - 2].textContent = String(index + 1);
      numbers[numbers.length - 1].textContent = String(total);
    } else if (numbers.length === 1) {
      numbers[0].textContent = String(index + 1);
    }
  });
}

/** Phân trang DOM do docx-preview dựng ra. Trả về tổng số trang. */
export function paginateDocx(container: HTMLElement | null): number {
  const wrapper = container?.querySelector<HTMLElement>(".docx-wrapper");
  if (!wrapper) return 0;

  const pages: HTMLElement[] = [];
  let page = wrapper.querySelector<HTMLElement>(":scope > section.docx");
  while (page) {
    pages.push(page);
    page = paginatePage(page);
  }

  updatePageNumbers(pages);
  return pages.length;
}
