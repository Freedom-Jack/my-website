/**
 * What the site does not hold on purpose (a word list): a question that names one of these is turned away before
 * anything is searched, at every step. A word list has false alarms (a question about insurance for children trips
 * it): it then says so, plainly, and searches nothing.
 */
const PRIVATE =
  /\b(salary|salaries|income|wage|net worth|how much (are|were) you paid|how much (do|does|did) .*\b(pay|earn|make)|how old|your age|birthday|born|married|are you single|wife|husband|girlfriend|boyfriend|kids?|children|parents|mother|father|religio\w*|god|politic\w*|vote|your health|blood type|home address|street address|phone number|your phone|cell number|mobile number)\b/i;

export const isPrivate = (line: string) => PRIVATE.test(line);
