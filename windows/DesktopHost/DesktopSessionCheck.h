#pragma once
#include <string>

namespace FieldMachine::Desktop {
struct SessionGrant {
    bool isActive = false;
    bool canControl = false;
};

// Asks the FIELD API whether `sessionId` is the tablet's active, approved
// remote session. The agent shares nothing without this server confirmation.
SessionGrant CheckRemoteSession(std::string const &deviceToken, std::string const &sessionId);
}
