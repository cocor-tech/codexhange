from typing import List, Dict

class BaseAdapter:
    name = "base"

    async def discover(self, brand: dict, client) -> List[Dict]:
        raise NotImplementedError
