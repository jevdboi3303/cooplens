"""
Lightweight TF-IDF embedder — replaces sentence-transformers.

Uses scikit-learn's TfidfVectorizer which:
- Has zero startup cost (no model download)
- Uses ~5MB RAM instead of ~500MB
- Is fast (pure numpy)
- Works well for skill keyword matching

Tradeoff: no semantic understanding, but for co-op scoring
(matching skill keywords like Python, React, AWS) TF-IDF performs
comparably to transformers at a fraction of the cost.
"""

import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity as sklearn_cosine

# Fit a global vectorizer on a large tech/skills vocabulary so the
# IDF weights are sensible even for short texts.
_VOCAB_CORPUS = [
    "python java javascript typescript golang rust c++ c# scala kotlin swift ruby php matlab r",
    "react vue angular nextjs nodejs express django fastapi flask html css tailwind bootstrap",
    "pandas numpy scikit-learn pytorch tensorflow keras spark hadoop airflow dbt sql postgresql mysql mongodb redis elasticsearch",
    "aws gcp azure docker kubernetes terraform ci cd github actions jenkins gitlab devops",
    "machine learning deep learning nlp computer vision data science analytics",
    "rest api graphql grpc microservices distributed systems cloud native serverless",
    "git agile scrum product management project management leadership communication",
    "research analysis writing problem solving critical thinking collaboration teamwork",
]

_vectorizer = TfidfVectorizer(
    analyzer="word",
    ngram_range=(1, 2),
    min_df=1,
    sublinear_tf=True,
    strip_accents="unicode",
    lowercase=True,
)
_vectorizer.fit(_VOCAB_CORPUS)


def embed(text: str) -> list[float]:
    """Return a TF-IDF vector as a plain Python list."""
    vec = _vectorizer.transform([text])
    return vec.toarray()[0].tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a).reshape(1, -1)
    vb = np.array(b).reshape(1, -1)
    result = sklearn_cosine(va, vb)
    return float(result[0][0])
