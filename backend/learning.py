"""Conservative Bayesian knowledge tracing. Engagement is not knowledge evidence."""


def update_mastery(prior: float, correct: bool, guess: float = 0.2,
                   slip: float = 0.1, learn: float = 0.08) -> float:
    prior = min(0.99, max(0.01, prior))
    if correct:
        posterior = prior * (1 - slip) / (prior * (1 - slip) + (1 - prior) * guess)
    else:
        posterior = prior * slip / (prior * slip + (1 - prior) * (1 - guess))
    return round(min(0.99, posterior + (1 - posterior) * learn), 4)