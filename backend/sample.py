"""Original, deliberately small course and reviewed assessment bank (CC0)."""

TOPICS = [
    ("supervised", "Supervised Learning", "Learn from labeled examples to predict unseen outcomes.", []),
    ("regression", "Linear Regression", "Fit a linear prediction function by minimizing squared error.", ["supervised"]),
    ("gradient", "Gradient Descent", "Iteratively reduce loss using its derivatives.", ["regression"]),
    ("overfitting", "Overfitting & Regularization", "Recognize generalization gaps and control model complexity.", ["regression"]),
    ("evaluation", "Model Evaluation", "Choose meaningful metrics and protect the test set.", ["supervised"]),
    ("neural", "Neural Networks", "Compose learned transformations and nonlinear activations.", ["gradient"]),
]

TEXTS = [
    "Supervised learning uses labeled training examples: each input x is paired with a target y. Classification predicts a discrete category, whereas regression predicts a continuous numerical value. Predicting a house price is a regression task; deciding whether an email is spam is a classification task. Generalization means performing well on previously unseen examples, not just memorizing the training set.",
    "Simple linear regression predicts y_hat = w*x + b, where w is the slope and b is the intercept. For w = 2, b = 1, and x = 3, the prediction is 7. Mean squared error (MSE) is the average of squared differences between predictions and true targets: MSE = sum((y_hat - y)^2) / n. With prediction errors 1 and 3, MSE = (1 + 9) / 2 = 5. Squaring errors penalizes larger errors more strongly.",
    "Gradient descent updates parameters in the direction opposite the loss gradient: w_new = w_old - learning_rate * gradient. The learning rate controls the step size. If w_old = 4, the learning rate is 0.1, and the gradient is 2, then w_new = 3.8. A learning rate that is too large can cause oscillation or divergence; a very small learning rate slows progress. A zero gradient indicates a stationary point, not necessarily a global minimum.",
    "Overfitting occurs when a model fits training-specific patterns or noise and performs worse on unseen data. Low training error together with high validation error is a typical sign. Regularization discourages overly complex models. L2 regularization adds lambda * sum(w_i^2) to the training loss, penalizing large weights. Increasing lambda strengthens that penalty; excessive regularization can cause underfitting. Early stopping uses validation performance to stop training before generalization deteriorates.",
    "Split data into training, validation, and test sets. Fit model parameters on training data, select hyperparameters using validation data, and evaluate the final model once on held-out test data. Accuracy is the proportion of all predictions that are correct. Precision = true_positives / (true_positives + false_positives); recall = true_positives / (true_positives + false_negatives). If true_positives = 8, false_positives = 2, and false_negatives = 4, precision = 0.8 and recall = 8/12. Accuracy can be misleading with imbalanced classes. Data leakage occurs when information unavailable at prediction time contaminates training or model selection.",
    "A feedforward neural network composes layers. Each layer applies a learned affine transformation followed by an activation function. Nonlinear activation functions let multiple layers represent nonlinear relationships. Without nonlinear activations, stacked affine layers are equivalent to a single affine transformation. ReLU(x) = max(0, x), so ReLU(-3) = 0 and ReLU(4) = 4. Backpropagation applies the chain rule to compute gradients of the loss with respect to parameters; an optimizer such as gradient descent then updates those parameters.",
]

# (topic index, kind, difficulty, prompt, correct answer, choices, explanation)
BANK = [
    (0,"mcq","easy","Which task is regression?","Predicting a house price",["Predicting a house price","Classifying spam email","Recognizing a digit category","Assigning a sentiment class"],"Regression predicts a continuous numerical value, such as a house price."),
    (0,"short","easy","What kind of training examples does supervised learning use?","labeled",[],"Each training input is paired with a target label."),
    (0,"mcq","medium","What does generalization describe?","Performance on unseen examples",["Performance on unseen examples","Memorizing training data","Increasing parameter count","Removing all labels"],"Generalization concerns new examples, not memorization."),
    (1,"numerical","easy","For y_hat = w*x + b with w = 2, b = 1 and x = 3, calculate y_hat.","7",[],"Substitute into the source formula: 2 × 3 + 1 = 7."),
    (1,"numerical","medium","Two predictions have errors 1 and 3. What is their mean squared error?","5",[],"MSE = (1² + 3²) / 2 = 5."),
    (1,"mcq","hard","Why does squared error penalize large errors more than small ones?","The error is squared",["The error is squared","The intercept is removed","All errors have equal cost","Only error signs count"],"MSE averages squared differences, which grow quadratically with error magnitude."),
    (2,"numerical","medium","A weight is 4, its gradient is 2, and the learning rate is 0.1. What is the next weight?","3.8",[],"w_new = 4 - 0.1 × 2 = 3.8."),
    (2,"mcq","easy","Which direction does gradient descent move parameters?","Opposite the loss gradient",["Opposite the loss gradient","Along the loss gradient","Always toward zero","A fixed random direction"],"Subtracting the gradient moves against the local direction of increasing loss."),
    (2,"mcq","hard","Does a zero gradient guarantee a global minimum?","No, it indicates a stationary point",["No, it indicates a stationary point","Yes, for every loss","Only with a large learning rate","Yes, if training lasts longer"],"The source explicitly warns that a stationary point is not necessarily a global minimum."),
    (3,"mcq","easy","Which observation is a typical sign of overfitting?","Low training error and high validation error",["Low training error and high validation error","High training error and low validation error","Equal zero errors on all data","No training examples"],"A gap between training and validation performance suggests training-specific fitting."),
    (3,"short","medium","Which regularization method adds a squared-weight penalty to the loss?","L2",[],"L2 adds lambda × sum(w_i²) to training loss."),
    (3,"mcq","hard","What can excessive regularization cause?","Underfitting",["Underfitting","Guaranteed perfect predictions","Removal of the test set","Guaranteed overfitting"],"An excessively strong complexity penalty can make the model too restrictive."),
    (4,"numerical","medium","With 8 true positives and 2 false positives, what is precision as a decimal?","0.8",[],"Precision = 8 / (8 + 2) = 0.8."),
    (4,"mcq","easy","Which split should guide hyperparameter selection?","Validation set",["Validation set","Final test set","All future data","Unlabeled production data"],"Use validation data for selection and keep test data for final evaluation."),
    (4,"short","hard","What term describes contamination by information unavailable at prediction time?","data leakage",[],"Leakage contaminates training or selection with information that should not be available."),
    (5,"numerical","easy","What is ReLU(-3)?","0",[],"ReLU(x) = max(0, x), hence max(0, -3) = 0."),
    (5,"numerical","medium","What is ReLU(4)?","4",[],"ReLU(x) = max(0, x), hence max(0, 4) = 4."),
    (5,"mcq","hard","Without nonlinear activations, stacked affine layers are equivalent to what?","A single affine transformation",["A single affine transformation","An arbitrary nonlinear function","A decision tree","A guaranteed global optimizer"],"Composing affine transformations remains an affine transformation."),
]