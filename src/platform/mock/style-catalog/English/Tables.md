# Tables

Look at cell padding, the header row, borders, how wide tables scroll, and how long text wraps inside a cell.

## Minimal

| Key | Value |
| --- | --- |
| Theme | Light |

## Eight columns

| Day | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Morning | Writing | Review | Writing | Planning | Writing | Walk | Rest |
| Afternoon | Meetings | Writing | Meetings | Writing | Release | Market | Reading |
| Evening | Reading | Run | Cooking | Run | Film | Friends | Planning |

## Long text in cells

| Decision | Reason | Consequence |
| --- | --- | --- |
| Autosave waits for an idle moment | Writing on every keystroke makes the watcher report a change for each letter, and a slow disk turns typing into a queue of writes. | A landed write shows nothing, and a failed write shows the Write failure bar until the next one succeeds. |
| The Rust side owns the Session file | Two windows would otherwise race to write the same JSON, and the renderer cannot write atomically. | The renderer sends the whole Session on every change and never reads the file directly. |
| Short | A short reason. | A short consequence. |

## Inline styles in cells

| Style | Example | Notes |
| --- | --- | --- |
| Bold | **Ready** | The header row is bold already |
| Italic | *pending review* | |
| Code | `save_note_content` | Should keep its background |
| Link | [example.com](https://example.com) | |
| Highlight | ==needs a decision== | Default yellow |
| Strikethrough | ~~dropped~~ | |
| Inline math | $\frac{a}{b}$ | Check the row height |
| Mixed | **bold**, `code` and a [link](https://example.com) | All in one cell |

## Numbers

| Quarter | Documents | Words | Average | Change |
| --- | --- | --- | --- | --- |
| Q1 | 128 | 96,410 | 753.2 | +4.1% |
| Q2 | 143 | 112,087 | 783.8 | +11.7% |
| Q3 | 97 | 61,550 | 634.5 | -32.2% |
| Q4 | 210 | 187,300 | 891.9 | +116.5% |
| Total | 578 | 457,347 | 791.3 | |

## Escaped pipe

| Expression | Meaning |
| --- | --- |
| `a \| b` | Either `a` or `b` |
| `cat notes.md \| wc -w` | Count the words in a file |
| yes \| no | A pipe outside code |

## Wikilinks in cells

| Document | Related |
| --- | --- |
| [[Welcome]] | [[Reading list]] |
| [[Projects/Plumo\|Plumo]] | [[Welcome\|the welcome note]] |

## Empty cells

| Task | Owner | Due | Done |
| --- | --- | --- | --- |
| Outline | Mira | Monday | yes |
| Images | | Tuesday | yes |
| English set | Jonas | | |
| Chinese set | | | |
| | | Friday | |

## Twelve rows

| Month | Days | Season | Note |
| --- | --- | --- | --- |
| January | 31 | Winter | Planning |
| February | 28 | Winter | Short month |
| March | 31 | Spring | First release |
| April | 30 | Spring | Bug fixes |
| May | 31 | Spring | Editor work |
| June | 30 | Summer | Explorer work |
| July | 31 | Summer | Holiday |
| August | 31 | Summer | Quiet |
| September | 30 | Autumn | Style catalog |
| October | 31 | Autumn | Polish |
| November | 30 | Autumn | Beta |
| December | 31 | Winter | Rest |

## Two tables with a paragraph between

| Shortcut | Action |
| --- | --- |
| ⌘P | Quick Open |
| ⌘K | Command Menu |

This paragraph separates two tables. The space above it and the space below it should match.

| Mode | Shows |
| --- | --- |
| Rich | Rendered blocks |
| Raw | Markdown source |

A closing paragraph directly after a table.
