export function buildSrcset(image, arr) {
  let srcset = '';

  arr.forEach((breakpoint, i) => {
    const comma = i < (arr.length - 1) ? ',' : '';

    srcset += `${image}?auto=compress,format&w=${breakpoint} ${breakpoint}w${comma}`;
  });

  return srcset;
}
