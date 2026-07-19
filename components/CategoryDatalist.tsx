export default function CategoryDatalist({ id, categories }: { id: string; categories: string[] }) {
  return (
    <datalist id={id}>
      {categories.map((c) => <option key={c} value={c} />)}
    </datalist>
  );
}
