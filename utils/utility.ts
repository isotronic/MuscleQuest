export const byteArrayToBase64 = (byteArray: any) => {
  const binaryString = Object.keys(byteArray)
    .map((key) => {
      return String.fromCharCode(byteArray[key]);
    })
    .join("");
  return btoa(binaryString);
};
