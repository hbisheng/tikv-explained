# Preface

The purpose of this book is simple: to help you build a **systematic understanding** of TiKV. That means building a mental model of its major components, the mechanisms behind them, and how they fit together.

TiKV is a large system with more than 550,000 lines of Rust. Without the big picture, it is easy to get lost in the code. This book tries to give you that map first.

**The book prioritizes human understanding.** The text has been kept as concise as possible to make it digestible for humans. The chapters start with the most accessible ideas and gradually build toward concepts that require more background. Think of it as climbing a mountain, one level at a time. Don't be daunted by its height. This book will guide you every step of the way.

The [Level Map](level-map.md) shows the path ahead and how the ideas build on one another. That is where the journey begins.

## Scope

This is not official TiKV documentation. It represents the author's view and focuses on the core ideas rather than every part of TiKV.

It is a work in progress and will continue to evolve.

## FAQ

### Who is this book for?

Anyone interested in understanding how TiKV works.

### Why bother with human understanding when coding agents can write code and solve issues on their own?

Humans are not completely out of the software development cycle - yet.

As coding agents become more capable, understanding every detail of a particular piece of code may matter less and less. But mental models matter more.

With the right model, you know how the system is expected to behave, where to look when something goes wrong, and how to extend, debug, or build upon it - much like working from a specification. It also helps you work better with AI: you can ask better questions to get better answers.

And when the day comes that coding agents completely take over, understanding the code will become a human hobby.

### Why not just read the TiKV code directly?

You should. No learning material, including this book, can replace reading the code.

But TiKV is a large repository, and reading it without a map can be difficult. AI makes code exploration much easier, but the experience can still feel fragmented and too detail-oriented.

This book provides the big picture and a step-by-step roadmap. Once you have the mental model, you can return to the code and use AI to fill in the details.

### Was this book AI-generated?

I hoped a prompt like `Give me a book about TiKV` would be enough, but it simply wasn't.

I tried tweaking prompts and skills and letting AI generate the text end to end. But more often than not, the result didn't feel natural or easy to digest. Maybe that's because I already have the mental model in my head and am very opinionated about how to present it. My goal is to maximize understanding for human readers.

Common issues in AI-generated drafts include:

- bringing up concepts without a proper introduction;
- listing implementation facts without giving intuition or the big picture;
- having a low signal-to-noise ratio, burying key insights in unnecessary text.

So the typical workflow is this: I throw in some keywords and concepts, and AI generates a draft. I read it and find myself very unhappy. After four or five rounds of prompting, I give up on the draft, but at least I get a refresh of the relevant concepts. I then write the outline and sentence skeletons myself, verify the ideas against the code when needed, and ask an agent to get the grammar right or fill in the language. I then review and edit the result sentence by sentence.
