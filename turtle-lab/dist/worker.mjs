import {generatePath} from './core.mjs';
self.onmessage = ({data}) => {
  try {
    const result = generatePath(data);
    self.postMessage({result},Object.values(result).filter(ArrayBuffer.isView).map(value=>value.buffer));
  } catch(error) { self.postMessage({error:error.message}); }
};
