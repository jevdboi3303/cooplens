import re
import io
import pdfplumber

# Ordered from specific → generic so longer matches win
SKILL_PATTERNS = [
    # Languages
    "python", "java", "javascript", "typescript", "c\\+\\+", "c#", "go", "rust",
    "kotlin", "swift", "r", "scala", "ruby", "php", "matlab",
    # Web
    "react", "vue", "angular", "next\\.js", "node\\.js", "express", "django",
    "fastapi", "flask", "html", "css", "tailwind",
    # Data / ML
    "pandas", "numpy", "scikit-learn", "pytorch", "tensorflow", "keras",
    "spark", "hadoop", "airflow", "dbt", "sql", "postgresql", "mysql",
    "mongodb", "redis", "elasticsearch",
    # Cloud / DevOps
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ci/cd",
    "github actions", "jenkins",
    # Other
    "graphql", "rest", "grpc", "kafka", "rabbitmq", "git",
]

_SKILL_RE = re.compile(
    r"\b(" + "|".join(SKILL_PATTERNS) + r")\b",
    re.IGNORECASE,
)


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages)


def extract_skills(text: str) -> list[str]:
    matches = _SKILL_RE.findall(text)
    return sorted({m.lower() for m in matches})
