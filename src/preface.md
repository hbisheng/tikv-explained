# Preface

The purpose of this book is simple: to help you build a systematic understanding of TiKV. That means building a mental model that truly reflects its internal mechanisms.

**The book prioritizes understanding**. The chapters start with the most accessible ideas and gradually build toward concepts that require more background. Think of it as climbing a mountain, one level at a time. Don't be daunted by its height. This book will guide you every step of the way.

This book is meant for humans to read. Coding agents are becoming extraordinarily efficient at producing code and comments, which makes accurate mental models more important, not less. With the right model, you know the expected behavior of the system and can go as deep as needed. It becomes easier to extend, debug, and build upon, much like working from a specification.

Coding details can now be checked easily by coding agents. What is more important for humans is to get the big picture and build the mental models.

I assumed documents like this could easily be written by AI, but after trying various approaches, I am still not satisfied. What agents produce out of the box often does not read naturally. The logical flow can be messed up. Sometimes they spend time explaining that something is not X instead of grasping the essence. They bring in a concept without an introduction and assume the reader already knows it. I tried to list all these problems in an editing skill. It improved the results a bit, but they are still not satisfactory.

Agent drafts also tend to be redundant and repetitive. I want the book to introduce things gradually, with each chapter adding something new. Instead, a draft may repeat a bunch of what earlier chapters have already discussed without bringing in useful information. I have had to keep asking agents to delete large parts of the text.

I believe less is more. This book does not try to contain every detail. It tries to contain the core ideas. Further details can be looked up in the code. Given that, the book is a developing piece, and new material can be added over time.

Sometimes a draft just does not feel right. I can give four or five rounds of instructions, and it still does not feel right. At that point, I may as well abandon the whole AI draft and write the skeleton of the sentences myself. I use my own brain to state the outline and logical flow, then ask an agent to fill in the details and turn the outline into grammatically correct sentences. Even then, some expressions do not read naturally or make the idea clear at a glance, so I still need to edit the text by hand, sentence by sentence. I also verify its accuracy by checking the code, often with another agent.

The other problem with letting an agent write everything is that there is no review or audit of its accuracy. This book is a curated summary reviewed by a TiKV developer, so at least it has a higher level of accuracy than an unaudited agent draft. But I also have to admit that the current content may still contain inaccuracies. In particular, the details are not listed 100% exhaustively. I think that once these mental models are in place, it becomes much easier to ask an agent to look up the exact code details.

Agents do not seem to understand what is easy and what is difficult for a human reader, what is the essence, and what is unnecessary to state in a document. For a book that aims to maximize understanding instead of just providing a technical reference, this makes it hard to write with unsupervised agents. There is not much need for another technical reference now that an agent can read the code directly. Agents do not seem to get what is hard for the human brain.

Or maybe they simply see things differently from me. I built this book to convey what I think and the way I see TiKV.

I guess agents are not as good at writing documents and books as they are at writing code. Of course, they may become better in the future, and I would love to see that. I could then use them to learn a new field systematically much faster.

The learning order is a recommendation, not a requirement. The levels only indicate a suggested learning order. Chapters near the peak are not necessarily much harder; they may simply require more background context to fully grasp. Treat the book as a map: start anywhere, jump around, and use whatever tools or methods help you learn. There is no single right way to learn.
