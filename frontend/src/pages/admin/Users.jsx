import React, { useEffect, useState } from 'react';
import api from '../../api/axios';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);

  const load = () => api.get('/admin/users').then(({ data }) => setUsers(data));

  useEffect(() => {
    load();
  }, []);

  const toggleBlock = async (id, isBlocked) => {
    await api.put(`/admin/users/${id}/block`, { isBlocked: !isBlocked });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this user? This cannot be undone.')) return;
    await api.delete(`/admin/users/${id}`);
    load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Membership</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-[28px]">Users</h2>
        </div>
        <span className="admin-badge border-slate-200 bg-slate-50 text-slate-600">{users.length} members</span>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200">
        <table className="w-full min-w-[620px] border-collapse bg-white">
          <thead>
            <tr>
              <th className="table-th">Name</th><th className="table-th">Email</th><th className="table-th">Joined</th>
              <th className="table-th">Status</th><th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td className="table-td font-medium text-slate-800">{u.name}</td>
                <td className="table-td">{u.email}</td>
                <td className="table-td">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="table-td">
                  <span className={`table-chip ${u.isBlocked ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-600'}`}>
                    {u.isBlocked ? 'Blocked' : 'Active'}
                  </span>
                </td>
                <td className="table-td">
                  <div className="flex gap-3">
                    <button className="link-btn" onClick={() => toggleBlock(u._id, u.isBlocked)}>
                      {u.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                    <button className="link-btn text-rose-600" onClick={() => handleDelete(u._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
