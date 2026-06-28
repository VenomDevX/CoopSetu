import { z } from 'zod';
import { handle, ok } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/require-user';
import { requireOrganization, requirePermission } from '@/lib/auth/require-organization';

const schema = z.object({
  items: z.array(z.string().min(1)).min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  return handle(async () => {
    const { taskId } = await params;
    const { supabase } = await requireUser();
    const m = await requireOrganization();
    
    // Ensure the user has permission to update tasks
    requirePermission(m, 'task:update');

    const body = schema.parse(await req.json());

    // 1. Verify task belongs to organization
    const { data: task } = await supabase
      .from('tasks')
      .select('id, project_id')
      .eq('id', taskId)
      .eq('organization_id', m.organizationId)
      .single();

    if (!task) throw new Error('Task not found');

    // 2. Create the checklist
    const { data: checklist, error: clErr } = await supabase
      .from('task_checklists')
      .insert({
        task_id: taskId,
        name: 'AI Generated Plan',
        created_by_member_id: m.memberId,
      })
      .select('id')
      .single();

    if (clErr || !checklist) throw new Error('Failed to create checklist');

    // 3. Create the checklist items
    const { error: itemsErr } = await supabase
      .from('task_checklist_items')
      .insert(
        body.items.map((item, index) => ({
          checklist_id: checklist.id,
          content: item,
          position: index,
        }))
      );

    if (itemsErr) throw new Error('Failed to insert checklist items');

    // 4. Log activity
    await supabase.from('task_activity').insert({
      task_id: taskId,
      activity_type: 'CHECKLIST_ADDED',
      actor_member_id: m.memberId,
      metadata: { checklist_name: 'AI Generated Plan', item_count: body.items.length },
    });

    return ok({ success: true, checklistId: checklist.id });
  });
}
