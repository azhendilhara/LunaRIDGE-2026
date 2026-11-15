/** Keep a physical slot until the underlying request settles, even if its UI ignores it. */
export function serialGate(){
 let tail:Promise<unknown>=Promise.resolve();
 return <T>(operation:()=>Promise<T>):Promise<T>=>{const current=tail.then(operation);tail=current.catch(()=>undefined);return current;};
}
