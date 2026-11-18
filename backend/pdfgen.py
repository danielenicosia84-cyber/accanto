import io
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak

GREEN = colors.HexColor("#235D43")
LIGHT = colors.HexColor("#E8F5E9")
BEIGE = colors.HexColor("#F7F5F0")
GREY = colors.HexColor("#64748B")
AMBER = colors.HexColor("#D97706")

_FONT_DIR = Path("/usr/share/fonts/truetype/liberation")
FONT = "Accanto"
FONT_B = "Accanto-Bold"
_registered = False


def _fonts():
    global _registered
    if _registered:
        return
    pdfmetrics.registerFont(TTFont(FONT, str(_FONT_DIR / "LiberationSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_B, str(_FONT_DIR / "LiberationSans-Bold.ttf")))
    pdfmetrics.registerFontFamily(FONT, normal=FONT, bold=FONT_B, italic=FONT, boldItalic=FONT_B)
    _registered = True


def styles():
    _fonts()
    return {
        "h1": ParagraphStyle("h1", fontName=FONT_B, fontSize=20, leading=24, textColor=GREEN, spaceAfter=4),
        "h2": ParagraphStyle("h2", fontName=FONT_B, fontSize=13.5, leading=17, textColor=GREEN, spaceBefore=10, spaceAfter=4),
        "h3": ParagraphStyle("h3", fontName=FONT_B, fontSize=11, leading=14, textColor=colors.black, spaceBefore=6, spaceAfter=2),
        "body": ParagraphStyle("body", fontName=FONT, fontSize=10.5, leading=15, textColor=colors.HexColor("#1E293B")),
        "small": ParagraphStyle("small", fontName=FONT, fontSize=8.5, leading=11, textColor=GREY),
        "cell": ParagraphStyle("cell", fontName=FONT, fontSize=9.5, leading=12, alignment=TA_LEFT),
        "cellb": ParagraphStyle("cellb", fontName=FONT_B, fontSize=9.5, leading=12),
        "big": ParagraphStyle("big", fontName=FONT_B, fontSize=15, leading=19, textColor=colors.black),
        "note": ParagraphStyle("note", fontName=FONT, fontSize=9.5, leading=13, textColor=colors.HexColor("#92400E"), backColor=colors.HexColor("#FEF3C7"), borderPadding=6),
    }


def _header_footer(title: str, subtitle: str):
    def draw(c, doc):
        w, h = A4
        c.saveState()
        c.setFillColor(GREEN)
        c.rect(0, h - 22 * mm, w, 22 * mm, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont(FONT_B, 15)
        c.drawString(16 * mm, h - 10 * mm, "Accanto")
        c.setFont(FONT, 8.5)
        c.drawString(16 * mm, h - 15.5 * mm, "I referti, in parole semplici")
        c.setFont(FONT_B, 11)
        c.drawRightString(w - 16 * mm, h - 10 * mm, title[:70])
        c.setFont(FONT, 8.5)
        c.drawRightString(w - 16 * mm, h - 15.5 * mm, subtitle[:90])
        c.setFillColor(GREY)
        c.setFont(FONT, 7.5)
        c.drawString(16 * mm, 9 * mm, "Documento informativo generato da Accanto. Non sostituisce il parere del medico. / Informational document, not medical advice.")
        c.drawRightString(w - 16 * mm, 9 * mm, f"{doc.page}")
        c.restoreState()
    return draw


def build_pdf(title: str, subtitle: str, story: list) -> bytes:
    _fonts()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=30 * mm, bottomMargin=18 * mm, title=title, author="Accanto")
    hf = _header_footer(title, subtitle)
    doc.build(story, onFirstPage=hf, onLaterPages=hf)
    return buf.getvalue()


def P(text, style="body"):
    return Paragraph(str(text if text is not None else "").replace("\n", "<br/>"), styles()[style])


def table(rows: list, col_widths=None, header=True, zebra=True, font_size=9.5):
    st = styles()
    data = []
    for i, r in enumerate(rows):
        data.append([Paragraph(str(c if c is not None else ""), st["cellb"] if (header and i == 0) else st["cell"]) for c in r])
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    cmds = [
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), LIGHT)]
    if zebra:
        for i in range(1 if header else 0, len(data)):
            if i % 2 == 0:
                cmds.append(("BACKGROUND", (0, i), (-1, i), BEIGE))
    t.setStyle(TableStyle(cmds))
    return t


def kv_table(pairs: list, col_widths=(55 * mm, 123 * mm)):
    st = styles()
    data = [[Paragraph(str(k), st["cellb"]), Paragraph(str(v if v else "-"), st["cell"])] for k, v in pairs]
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
    ]))
    return t


__all__ = ["build_pdf", "P", "table", "kv_table", "Spacer", "KeepTogether", "PageBreak", "styles", "mm"]
