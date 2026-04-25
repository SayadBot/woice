import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Database from '@tauri-apps/plugin-sql'

const HISTORY_QUERY_KEY = ['history', 'history-records']

export function DeleteHistoryButton() {
  const queryClient = useQueryClient()

  const deleteAllHistory = useMutation({
    mutationFn: async () => {
      const db = Database.get('sqlite:woice.db')
      await db.execute('DELETE FROM history')
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY })
    },
  })

  const isPending = deleteAllHistory.isPending

  return (
    <div className="space-y-2 sm:ml-auto">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm" className="w-full sm:w-auto">
            {isPending && <Spinner className="size-4" />}
            {isPending ? 'Deleting...' : 'Delete all history'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all rows from your history. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => deleteAllHistory.mutate()}
            >
              {isPending && <Spinner className="size-4" />}
              {isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {deleteAllHistory.isError && (
        <p className="text-destructive text-sm">
          {deleteAllHistory.error instanceof Error
            ? deleteAllHistory.error.message
            : 'Failed to delete history.'}
        </p>
      )}
    </div>
  )
}
