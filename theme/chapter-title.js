const bookTitle = "TiKV Explained: Mental Models from the Ground Up";
const titleSuffix = ` - ${bookTitle}`;

if (document.title.endsWith(titleSuffix)) {
    document.title = document.title.slice(0, -titleSuffix.length);
}
