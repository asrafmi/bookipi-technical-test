export default async function awaitToError<E = Error, T = unknown>(
  p: Promise<T>,
): Promise<[E, null] | [null, T]> {
  try {
    const r = await p;
    return [null, r];
  } catch (e) {
    return [e as E, null];
  }
}
