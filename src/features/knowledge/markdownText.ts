/**
 * Les textes cités gardent l'emphase Markdown de leur document source, et les
 * écrans l'affichaient telle quelle : « les chefs **latéral** et **médial** ».
 * On ne peut pas la rendre en gras sans réinterpréter le texte cité, alors on la
 * retire — une citation exacte se juge sur ses mots, pas sur ses astérisques.
 */
export function stripEmphasis(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gsu, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gsu, '$1');
}
