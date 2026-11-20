# Learn the Code - teaching notebooks

This folder holds the **"Learn the Code"** notebooks for Engineering ML Studio. They are the next rung after the browser **Explore** mode: you do the activity with no code in the browser, then reproduce the same workflow in Python here.

> **Training demonstration, not a design tool.** These notebooks use synthetic, documented datasets and are for learning on small, non-critical problems. They are not validated, safety-grade or design-quality tools, and must not be used for real engineering design decisions.

## Notebooks

| Notebook                                                       | What it covers                                                                                                                                                                                                                                                                                                                                                                                                  | Companion Explore activity               |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [`pipe_pressure_drop.ipynb`](pipe_pressure_drop.ipynb)         | Predicting **pressure drop in a pipe** from geometry and flow conditions, with Linear Regression, a Decision Tree and a Random Forest; metrics (RMSE, R-squared) in kPa; an actual-versus-predicted plot; engineering interpretation (trend checks, plausibility and extrapolation); and an **optional advanced Section 16** adding a `scikit-learn` neural network (`MLPRegressor`).                           | Explore: Predict pressure drop in a pipe |
| [`steel_tensile_strength.ipynb`](steel_tensile_strength.ipynb) | Predicting **steel yield strength** from composition, grain size and temperature, with Linear Regression, a Decision Tree and a Random Forest; metrics (RMSE, R-squared) in MPa; actual-versus-predicted plots; engineering interpretation (trend checks, plausibility, extrapolation and specimen variation); and an **optional advanced Section 16** adding a `scikit-learn` neural network (`MLPRegressor`). | Explore: Steel yield strength            |

### Pipe pressure drop

The pipe notebook mirrors the browser activity: the same dataset (`../examples/pipe_pressure_drop_sample.csv`), the same five inputs and target, the same fixed random seed (42), and the same three core models. Exact numbers differ slightly from the browser because of different model implementations and a different random split. The engineering story is the same.

See [`../docs/PHASE2_LEARN_THE_CODE_PLAN.md`](../docs/PHASE2_LEARN_THE_CODE_PLAN.md), Section 2a, for the comparison.

The final **optional, advanced** section adds a neural network (`MLPRegressor` in a `StandardScaler` pipeline, `(32, 16)`, fixed seed and early stopping). It is deliberately placed last and framed honestly: a more complex model is not automatically more accurate, and here the network does not beat the Random Forest.

See [`../docs/NEURAL_NETWORK_DEMO.md`](../docs/NEURAL_NETWORK_DEMO.md).

### Steel tensile strength

The steel notebook uses the synthetic dataset at `../examples/steel_tensile_strength_sample.csv`. It predicts yield strength in MPa from six inputs:

- Carbon content (wt%)
- Manganese content (wt%)
- Silicon content (wt%)
- Grain size (micrometres)
- Tempering temperature (degrees C)
- Test temperature (degrees C)

The underlying synthetic relationship combines the nonlinear Hall-Petch relationship for grain-size strengthening with simplified composition and temperature corrections. Multiplicative specimen variation is also included to demonstrate how variation in the data affects model predictions.

The notebook compares the same three core model types as the pipe notebook: Linear Regression, Decision Tree and Random Forest. It uses a fixed random seed (42) and a training, validation and test split. The results illustrate that a simpler model can perform competitively, and that greater model complexity does not necessarily produce better predictions.

The final **optional, advanced** section introduces an `MLPRegressor` neural network using a `StandardScaler` pipeline and the same general architecture as the pipe notebook. It compares early stopping with longer training and considers whether the additional complexity improves performance.

The steel relationship is a simplified teaching model. Its coefficients are not universal material constants, and the dataset does not represent measured or validated steel properties. Real steel behaviour depends on additional factors that are not represented in this example.

## How to open the notebooks

### Option A - Google Colab (recommended, nothing to install)

One click, no local setup. `pandas`, `scikit-learn` and `matplotlib` are available in the Colab environment.

**Pipe pressure drop**

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/weiwangstfc/engineering-ml-studio/blob/main/notebooks/pipe_pressure_drop.ipynb)

**Steel tensile strength**

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/weiwangstfc/engineering-ml-studio/blob/main/notebooks/steel_tensile_strength.ipynb)

In Colab, the notebook cannot see the repository's local files, so it automatically falls back to the committed copy of the relevant dataset on GitHub. Each notebook uses a documented dataset location in the repository.

You need a Google account and an internet connection.

### Option B - Local Jupyter (offline, uses this checkout)

From the repository root:

```bash
python -m pip install -r notebooks/requirements.txt
python -m pip install jupyterlab  # if you do not already have Jupyter
```

Start either notebook:

```bash
jupyter lab notebooks/pipe_pressure_drop.ipynb
```

```bash
jupyter lab notebooks/steel_tensile_strength.ipynb
```

Run the cells from top to bottom. When run locally, each notebook loads its dataset directly from the corresponding file in `../examples/`, so no internet connection is needed.

### Option C - VS Code

Open either `.ipynb` file with the Python and Jupyter extensions installed, select a kernel with the packages from `requirements.txt`, and run the cells.

This is a secondary route. Options A and B are the supported routes.

## What you need

- Python 3.9+ and the packages in [`requirements.txt`](requirements.txt). Colab already provides the required packages.
- No GPU, no external machine learning services or cloud services. A Google account is only required for Colab.

## Reproducibility and testing

- Both notebooks use a **fixed seed (42)** throughout, so rerunning gives reproducible data splits and model results.
- Both notebooks are **committed without stored outputs**, so the version history stays clean and every run starts fresh.
- Automated tests check notebook structure and execute the notebooks end-to-end. See [`../tests/test_notebook_execution.py`](../tests/test_notebook_execution.py) and [`../tests/test_notebook_structure.py`](../tests/test_notebook_structure.py). These tests also run in CI.

## Important limitations

Both datasets are synthetic teaching demonstrations. They are documented to explain how the data was generated, but they are not experimental datasets or validated engineering models.

The pipe notebook uses a simplified fluid-mechanics relationship. The steel notebook uses an approximate Hall-Petch relationship and simplified composition and temperature corrections. Neither represents every factor involved in real engineering systems.

Predictions and datasets must not be used for material selection, structural design, safety-critical qualification, certification or other real engineering decisions.

## Attribution and licence

Engineering ML Studio is a redevelopment of **Local Regression Studio** by **Yu Duan** (MIT
licence). New contributions in this project are copyright **UKRI**, released under the same MIT terms
(see [`../LICENSES.txt`](../LICENSES.txt)), without altering the original work's copyright or
attribution. The pressure-drop dataset used here is a synthetic teaching demonstration; see
[`../examples/README.md`](../examples/README.md).
