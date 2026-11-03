"""Matrix: abstract base of every labelled matrix (transition and payoff)."""
from abc import ABC, abstractmethod

import numpy as np
import pandas as pd


class Matrix(ABC):
    """A len(rows) x len(columns) array with row and column labels; subclasses compute values on first access and cache it."""

    rows: list[str]
    columns: list[str]

    @property
    @abstractmethod
    def values(self) -> np.ndarray: ...

    def to_frame(self) -> pd.DataFrame:
        return pd.DataFrame(self.values, index=self.rows, columns=self.columns)

    def __matmul__(self, x) -> np.ndarray:
        return self.values @ np.asarray(x)
