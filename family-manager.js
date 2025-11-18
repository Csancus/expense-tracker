// Family/Group Management System
class FamilyManager {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentGroup = null;
        this.userGroups = [];
        this.init();
    }

    async init() {
        await this.loadUserGroups();
        this.setupUI();
    }

    async loadUserGroups() {
        try {
            const { data, error } = await this.supabase.rpc('get_user_groups');
            if (error) throw error;
            
            this.userGroups = data || [];
            console.log('User groups loaded:', this.userGroups);
            
            // Set current group to first one or personal
            if (this.userGroups.length > 0) {
                this.currentGroup = this.userGroups[0];
            }
            
            this.updateGroupSelector();
        } catch (error) {
            console.error('Failed to load user groups:', error);
        }
    }

    setupUI() {
        this.createGroupManagementUI();
        this.createGroupSelector();
    }

    createGroupSelector() {
        const header = document.querySelector('.header-content');
        if (!header) return;

        // Remove existing group selector
        const existing = header.querySelector('.group-selector');
        if (existing) existing.remove();

        const groupSelector = document.createElement('div');
        groupSelector.className = 'group-selector';
        groupSelector.innerHTML = `
            <div class="group-dropdown">
                <button class="current-group-btn" onclick="familyManager.toggleGroupDropdown()">
                    <span class="group-icon">👨‍👩‍👧‍👦</span>
                    <span class="group-name">${this.currentGroup?.group_name || 'Personal'}</span>
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="group-dropdown-menu" id="groupDropdown" style="display: none;">
                    <div class="group-list"></div>
                    <div class="group-actions">
                        <button class="btn btn-sm" onclick="familyManager.showCreateGroup()">
                            ➕ Create Group
                        </button>
                        <button class="btn btn-sm" onclick="familyManager.showJoinGroup()">
                            🔗 Join Group
                        </button>
                        <button class="btn btn-sm" onclick="familyManager.showManageGroups()">
                            ⚙️ Manage
                        </button>
                    </div>
                </div>
            </div>
        `;

        header.appendChild(groupSelector);
        this.updateGroupDropdown();
    }

    updateGroupSelector() {
        const groupName = document.querySelector('.group-name');
        if (groupName) {
            groupName.textContent = this.currentGroup?.group_name || 'Personal';
        }
        this.updateGroupDropdown();
    }

    updateGroupDropdown() {
        const groupList = document.querySelector('.group-list');
        if (!groupList) return;

        groupList.innerHTML = this.userGroups.map(group => `
            <div class="group-item ${this.currentGroup?.group_id === group.group_id ? 'active' : ''}" 
                 onclick="familyManager.selectGroup('${group.group_id}')">
                <div class="group-item-info">
                    <span class="group-item-name">${group.group_name}</span>
                    <span class="group-item-role">${group.is_owner ? 'Owner' : group.role}</span>
                    <span class="group-item-members">${group.member_count} members</span>
                </div>
            </div>
        `).join('');
    }

    toggleGroupDropdown() {
        const dropdown = document.getElementById('groupDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        }
    }

    selectGroup(groupId) {
        this.currentGroup = this.userGroups.find(g => g.group_id === groupId);
        this.updateGroupSelector();
        this.toggleGroupDropdown();
        
        // Trigger data reload with new group context
        window.dispatchEvent(new CustomEvent('groupChanged', { 
            detail: { group: this.currentGroup } 
        }));
    }

    async createGroup(name, description) {
        try {
            const { data, error } = await this.supabase
                .from('groups')
                .insert({
                    name: name,
                    description: description
                })
                .select()
                .single();

            if (error) throw error;

            await this.loadUserGroups();
            this.selectGroup(data.id);
            
            return { success: true, group: data };
        } catch (error) {
            console.error('Failed to create group:', error);
            return { success: false, error: error.message };
        }
    }

    async inviteUser(groupId, email, role = 'member') {
        try {
            const permissions = {
                view: true,
                add: role !== 'viewer',
                edit: ['owner', 'admin'].includes(role),
                delete: role === 'owner'
            };

            const { data, error } = await this.supabase
                .from('group_invitations')
                .insert({
                    group_id: groupId,
                    email: email,
                    role: role,
                    permissions: permissions
                })
                .select()
                .single();

            if (error) throw error;

            // Send invitation email (would need email service integration)
            await this.sendInvitationEmail(email, data.invite_token);

            return { success: true, invitation: data };
        } catch (error) {
            console.error('Failed to invite user:', error);
            return { success: false, error: error.message };
        }
    }

    async sendInvitationEmail(email, token) {
        // For now, just show the invitation link
        const inviteUrl = `${window.location.origin}?invite=${token}`;
        
        // Show invitation link to copy
        alert(`Invitation created! Share this link with ${email}:\n\n${inviteUrl}`);
        
        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(inviteUrl);
            console.log('Invitation link copied to clipboard');
        } catch (err) {
            console.log('Could not copy to clipboard:', err);
        }
    }

    async acceptInvitation(token) {
        try {
            const { data, error } = await this.supabase.rpc('accept_group_invitation', {
                invitation_token: token
            });

            if (error) throw error;

            if (data.success) {
                await this.loadUserGroups();
                this.selectGroup(data.group_id);
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Failed to accept invitation:', error);
            return { success: false, error: error.message };
        }
    }

    createGroupManagementUI() {
        // Add CSS for group management
        const style = document.createElement('style');
        style.textContent = `
            .group-selector {
                position: relative;
                margin-left: auto;
                margin-right: 1rem;
            }
            
            .current-group-btn {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                background: var(--card-bg, white);
                border: 1px solid var(--border-color, #e5e7eb);
                border-radius: 0.5rem;
                cursor: pointer;
                font-size: 0.875rem;
                transition: all 0.2s ease;
            }
            
            .current-group-btn:hover {
                background: var(--hover-bg, #f9fafb);
            }
            
            .group-dropdown-menu {
                position: absolute;
                top: 100%;
                right: 0;
                min-width: 280px;
                background: white;
                border: 1px solid var(--border-color, #e5e7eb);
                border-radius: 0.5rem;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                z-index: 1000;
                overflow: hidden;
            }
            
            .group-item {
                padding: 0.75rem;
                border-bottom: 1px solid var(--border-color, #f3f4f6);
                cursor: pointer;
                transition: background 0.2s ease;
            }
            
            .group-item:hover {
                background: var(--hover-bg, #f9fafb);
            }
            
            .group-item.active {
                background: var(--primary-bg, #dbeafe);
            }
            
            .group-item-name {
                display: block;
                font-weight: 600;
                color: var(--text-primary, #111827);
            }
            
            .group-item-role {
                display: inline-block;
                font-size: 0.75rem;
                background: var(--badge-bg, #f3f4f6);
                color: var(--badge-text, #6b7280);
                padding: 0.125rem 0.375rem;
                border-radius: 0.25rem;
                margin-top: 0.25rem;
                margin-right: 0.5rem;
            }
            
            .group-item-members {
                font-size: 0.75rem;
                color: var(--text-secondary, #6b7280);
            }
            
            .group-actions {
                padding: 0.75rem;
                border-top: 1px solid var(--border-color, #f3f4f6);
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .group-actions .btn {
                text-align: left;
                background: none;
                border: none;
                padding: 0.5rem;
                border-radius: 0.25rem;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            
            .group-actions .btn:hover {
                background: var(--hover-bg, #f9fafb);
            }
            
            .modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            }
            
            .modal-content {
                background: white;
                border-radius: 0.5rem;
                padding: 2rem;
                max-width: 400px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }
            
            @media (max-width: 768px) {
                .group-dropdown-menu {
                    right: -1rem;
                    left: -1rem;
                    min-width: auto;
                }
                
                .current-group-btn {
                    padding: 0.375rem 0.75rem;
                    font-size: 0.8rem;
                }
                
                .group-name {
                    max-width: 120px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            }
        `;
        document.head.appendChild(style);
    }

    showCreateGroup() {
        this.toggleGroupDropdown();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Create New Group</h2>
                <form id="createGroupForm">
                    <div class="form-group">
                        <label>Group Name:</label>
                        <input type="text" id="groupName" required maxlength="100" 
                               placeholder="My Family, Team Alpha, etc.">
                    </div>
                    <div class="form-group">
                        <label>Description (optional):</label>
                        <textarea id="groupDescription" rows="3" maxlength="500"
                                  placeholder="Shared expenses for our family"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Create Group</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('createGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('groupName').value;
            const description = document.getElementById('groupDescription').value;
            
            const result = await this.createGroup(name, description);
            
            if (result.success) {
                modal.remove();
                alert('Group created successfully!');
            } else {
                alert('Failed to create group: ' + result.error);
            }
        });
    }

    showJoinGroup() {
        this.toggleGroupDropdown();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Join Group</h2>
                <p>Enter the invitation link or code you received:</p>
                <form id="joinGroupForm">
                    <div class="form-group">
                        <label>Invitation Link or Code:</label>
                        <input type="text" id="inviteCode" required 
                               placeholder="https://... or invitation code">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Join Group</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('joinGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let code = document.getElementById('inviteCode').value.trim();
            
            // Extract token from URL if full URL provided
            if (code.includes('invite=')) {
                code = code.split('invite=')[1].split('&')[0];
            }
            
            const result = await this.acceptInvitation(code);
            
            if (result.success) {
                modal.remove();
                alert('Successfully joined group!');
            } else {
                alert('Failed to join group: ' + result.error);
            }
        });
    }

    showManageGroups() {
        this.toggleGroupDropdown();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Manage Groups</h2>
                <div id="groupManagementContent">
                    ${this.userGroups.map(group => `
                        <div class="group-management-item">
                            <div class="group-info">
                                <h3>${group.group_name}</h3>
                                <p>${group.is_owner ? 'Owner' : group.role} • ${group.member_count} members</p>
                            </div>
                            <div class="group-actions">
                                ${group.is_owner ? `
                                    <button class="btn btn-sm" onclick="familyManager.showInviteUsers('${group.group_id}')">
                                        📧 Invite Users
                                    </button>
                                ` : ''}
                                <button class="btn btn-sm" onclick="familyManager.showGroupMembers('${group.group_id}')">
                                    👥 View Members
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async showInviteUsers(groupId) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Invite Users</h2>
                <form id="inviteUserForm">
                    <div class="form-group">
                        <label>Email Address:</label>
                        <input type="email" id="inviteEmail" required 
                               placeholder="user@example.com">
                    </div>
                    <div class="form-group">
                        <label>Role:</label>
                        <select id="inviteRole">
                            <option value="member">Member (can add/view expenses)</option>
                            <option value="admin">Admin (can manage group)</option>
                            <option value="viewer">Viewer (can only view)</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary">Send Invitation</button>
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('inviteUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('inviteEmail').value;
            const role = document.getElementById('inviteRole').value;
            
            const result = await this.inviteUser(groupId, email, role);
            
            if (result.success) {
                modal.remove();
            } else {
                alert('Failed to send invitation: ' + result.error);
            }
        });
    }

    getCurrentGroupId() {
        return this.currentGroup?.group_id || null;
    }

    isPersonalMode() {
        return !this.currentGroup || this.currentGroup.group_id === null;
    }
}

// Auto-initialize when supabase is available
window.addEventListener('load', () => {
    // Check for invitation in URL
    const urlParams = new URLSearchParams(window.location.search);
    const inviteToken = urlParams.get('invite');
    
    if (inviteToken) {
        // Store invite token to process after login
        sessionStorage.setItem('pendingInvite', inviteToken);
    }
});

// Export for use
if (typeof window !== 'undefined') {
    window.FamilyManager = FamilyManager;
}