import { BoardContent } from "../board-content";

export default async function BoardTasksPage(
  props: PageProps<"/boards/[id]">,
) {
  const { id: boardId } = await props.params;
  return <BoardContent boardId={boardId} />;
}
