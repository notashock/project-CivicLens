import re
import io
import base64
import logging
from typing import Optional, Tuple, List
from PIL import Image

logger = logging.getLogger("civictrace.neutrality")

# Curated Political Entities, Parties, Coalitions & Acronyms
POLITICAL_PARTIES = [
    r"\bbjp\b", r"\bbharatiya\s+janata(\s+party)?\b",
    r"\binc\b", r"\bcongress(\s+party)?\b", r"\bindian\s+national\s+congress\b",
    r"\baap\b", r"\baam\s+aadmi(\s+party)?\b",
    r"\btmc\b", r"\btrinamool(\s+congress)?\b",
    r"\bdmk\b", r"\bdravida\s+munnetra\s+kazhagam\b",
    r"\baiadmk\b",
    r"\bshiv\s+sena\b", r"\buddhav\s+sena\b",
    r"\bncp\b", r"\bnationalist\s+congress\s+party\b",
    r"\bbsp\b", r"\bbahujan\s+samaj(\s+party)?\b",
    r"\bsp\b", r"\bsamajwadi(\s+party)?\b",
    r"\bcpi\b", r"\bcpim\b", r"\bcpm\b", r"\bcommunist\s+party\b",
    r"\bjdu\b", r"\bjanata\s+dal(\s+united)?\b",
    r"\brjd\b", r"\brashtriya\s+janata\s+dal\b",
    r"\btdp\b", r"\btelugu\s+desam(\s+party)?\b",
    r"\bysrcp\b", r"\bysr\s+congress\b",
    r"\btrs\b", r"\bbrs\b", r"\bbharat\s+rashtra\s+samithi\b",
    r"\baimim\b", r"\bakali\s+dal\b", r"\bjmm\b",
    r"\bnda\b", r"\bupa\b", r"\bi\.?n\.?d\.?i\.?a\s+alliance\b"
]

# Political Titles & Elected Office Designations
POLITICAL_OFFICES = [
    r"\bmla\b", r"\bmp\b", r"\bmember\s+of\s+parliament\b", r"\bmember\s+of\s+legislative\s+assembly\b",
    r"\bcorporator\b", r"\bcouncillor\b", r"\bcouncilor\b", r"\bward\s+councillor\b", r"\bward\s+member\b",
    r"\bmayor\b", r"\bdeputy\s+mayor\b",
    r"\bminister\b", r"\bchief\s+minister\b", r"\bcm\b",
    r"\bprime\s+minister\b", r"\bpm\b",
    r"\bneta\b", r"\bnetaji\b", r"\bparty\s+worker\b", r"\bkaryakarta\b",
    r"\bpradhan\b", r"\bsarpanch\b", r"\bgram\s+pradhan\b", r"\bpanchayat\s+president\b"
]

# Prominent Figures & Personal Honorific Naming Patterns
INDIVIDUAL_PATTERNS = [
    r"\bmodi\b", r"\bnarendra\s+modi\b",
    r"\brahul\s+gandhi\b", r"\bsonia\s+gandhi\b", r"\bpriyanka\s+gandhi\b",
    r"\barvind\s+kejriwal\b", r"\bkejriwal\b",
    r"\bmamata\s+banerjee\b", r"\bmamata\b",
    r"\bm\.?k\.?\s+stalin\b", r"\bstalin\b",
    r"\byogi\s+adityanath\b", r"\byogiji?\b",
    r"\bsiddaramaiah\b", r"\bd\.?k\.?\s+shivakumar\b",
    r"\bdevendra\s+fadnavis\b", r"\bevnath\s+shinde\b", r"\buddhav\s+thackeray\b",
    r"\bnitish\s+kumar\b", r"\btejashwi\s+yadav\b",
    r"\bsharad\s+pawar\b", r"\bajit\s+pawar\b",
    r"\bakhilesh\s+yadav\b", r"\bmayawati\b",
    r"\bhimanta\s+biswa\b", r"\bchavan\b",
    # Honorifics preceding personal names (e.g. "Shri Sharma", "Mr. Verma", "Hon'ble Patel")
    r"\b(shri|smt|shrimati|mr\.?|mrs\.?|dr\.?|hon'?ble|honourable)\s+[a-z]{3,}\b"
]

# Precompiled Master Regex Pattern (Case-Insensitive)
COMBINED_POLITICAL_REGEX = re.compile(
    "|".join(POLITICAL_PARTIES + POLITICAL_OFFICES),
    re.IGNORECASE
)

COMBINED_NAME_REGEX = re.compile(
    "|".join(INDIVIDUAL_PATTERNS),
    re.IGNORECASE
)


class NeutralityFilter:
    """
    DEEP MODULE: Dual-tier content moderation and political neutrality validator.
    Implements ADR 0006 and ADR 0012 to prevent partisan finger-pointing,
    defamatory attacks, or personal targeting in civic infrastructure records.
    """

    def validate_text(self, text: str) -> Optional[str]:
        """
        Validates text against political party mentions, political office designations,
        and named individuals.
        
        Returns:
            Error message string if violation detected, None if valid.
        """
        if not text or not text.strip():
            return None

        clean_text = " ".join(text.strip().split())

        # Check political entities and designations
        pol_match = COMBINED_POLITICAL_REGEX.search(clean_text)
        if pol_match:
            matched_term = pol_match.group(0).strip()
            return (
                f"Neutrality violation: Mention of political entity, title, or party '{matched_term}' "
                f"is strictly prohibited. Submissions must objectively describe observable physical conditions only."
            )

        # Check named individuals and honorific patterns
        name_match = COMBINED_NAME_REGEX.search(clean_text)
        if name_match:
            matched_term = name_match.group(0).strip()
            return (
                f"Neutrality violation: Reference to named individual or public figure '{matched_term}' "
                f"is strictly prohibited. Submissions must focus strictly on the physical infrastructure hazard."
            )

        return None

    def validate_image_ocr(self, base64_data: str) -> Optional[str]:
        """
        Scans uploaded photo evidence using OCR to catch political campaign banners,
        partisan slogans, or candidate posters.
        
        Gracefully handles environments where tesseract binary is not installed.
        Returns:
            Error message string if prohibited text found in image, None if clean.
        """
        if not base64_data or len(base64_data) < 50:
            return None

        # Strip Data URI header if present (e.g. data:image/jpeg;base64,...)
        payload = base64_data
        if "," in base64_data:
            payload = base64_data.split(",", 1)[1]

        try:
            image_bytes = base64.b64decode(payload)
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            logger.warning(f"Could not decode image for OCR validation: {e}")
            return None

        try:
            import pytesseract
            # Run OCR on the image
            extracted_text = pytesseract.image_to_string(image, timeout=3)
            if extracted_text and extracted_text.strip():
                # Check extracted text against neutrality filter
                ocr_violation = self.validate_text(extracted_text)
                if ocr_violation:
                    return f"Image moderation violation: Photo evidence contains prohibited political or candidate text. {ocr_violation}"
        except (ImportError, Exception) as e:
            # Tesseract binary not installed on system or timed out; log and gracefully pass
            logger.debug(f"OCR optical scan bypassed: {e}")

        return None

    def validate_submission(self, text: str, media_list: Optional[List[str]] = None) -> Tuple[bool, Optional[str]]:
        """
        Full dual-tier validation checking both text narrative and any photo evidence.
        """
        # 1. Text check
        text_error = self.validate_text(text)
        if text_error:
            return False, text_error

        # 2. Image OCR check
        if media_list:
            for idx, img_b64 in enumerate(media_list):
                img_error = self.validate_image_ocr(img_b64)
                if img_error:
                    return False, f"Evidence photo #{idx + 1}: {img_error}"

        return True, None


neutrality_filter = NeutralityFilter()
