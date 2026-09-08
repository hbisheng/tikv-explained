const bookTitle = "TiKV Explained: Mental Models from the Ground Up";
const titleSuffix = ` - ${bookTitle}`;
const titlesThatNeedBookContext = new Set(["Preface", "Level Map"]);

if (document.title.endsWith(titleSuffix)) {
    const pageTitle = document.title.slice(0, -titleSuffix.length);
    if (!titlesThatNeedBookContext.has(pageTitle)) {
        document.title = pageTitle;
    }
}
