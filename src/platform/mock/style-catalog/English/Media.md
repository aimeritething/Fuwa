# Media

Look at how images of different shapes fit the text column, the space above and below them, the missing-image state, and file attachment blocks.

## Landscape

A wide photo, 1600 by 900. It should fill the text column and keep its proportions.

![Lake Cerknica seen from a hillside, calm water reflecting low hills](../images/cerknica-landscape.jpg)

The paragraph after the landscape photo. The gap above this line should match the gap below the paragraph before the image.

## Portrait

A tall picture, 800 by 1140. Check that it does not push the next paragraph a full screen away.

![Hokusai woodblock print of the Amida Falls dropping between steep cliffs](../images/hokusai-amida-falls-portrait.jpg)

The paragraph after the portrait picture.

## Panorama

A very wide picture, 2000 by 494, about four to one. It should stay readable when the window is narrow.

![Panorama of forested mountain ridges from Oak Mountain, facing east](../images/oak-mountain-panorama.jpg)

The paragraph after the panorama.

## Small and square

A nearly square drawing, 800 by 776, with fine pencil detail.

![Pencil studies of cornflowers by Julie de Graag](../images/cornflower-study-square.jpg)

The paragraph after the square drawing.

## Transparent icon

A small SVG, 96 by 96, with a transparent background. It should not be stretched to the column width, and the page background should show through it in both themes.

![The Plumo mark, a small transparent icon](../images/mark-transparent.svg)

The paragraph after the icon.

## Empty alt text

![](../images/cornflower-study-square.jpg)

The image above has no alt text.

## Two images in a row

![Lake Cerknica in calm weather](../images/cerknica-landscape.jpg)

![Mountain ridges in a wide panorama](../images/oak-mountain-panorama.jpg)

The paragraph after two consecutive images.

## An image directly under a heading

![Cornflower studies directly under a heading](../images/cornflower-study-square.jpg)

## Missing image

The file below does not exist, so this shows the missing-image state.

![Missing picture](../images/does-not-exist.png)

The paragraph after the missing image.

## File attachments

A link on its own line that points at an attachment becomes a file block.

[report.pdf](attachments/report.pdf)

A file block with a title, which becomes its caption:

[brief.pdf](attachments/brief.pdf "Project brief, draft 3")

Two file blocks in a row:

[report.pdf](attachments/report.pdf)

[brief.pdf](attachments/brief.pdf "Project brief, draft 3")

A link inside a sentence stays a link: see [report.pdf](attachments/report.pdf) for the numbers.

## Audio and video

Audio and video have no Markdown syntax of their own, so they are saved as plain links and reopen as file blocks; the two files below do not exist on purpose.

[demo.mov](attachments/demo.mov)

[clip.mp3](attachments/clip.mp3)

A closing paragraph directly after a file block.
